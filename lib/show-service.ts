import { Prisma, QueueItemStatus } from "@/generated/prisma/client";
import { createCallerSnapshot } from "@/lib/caller";
import { callerSnapshotSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { publishShowUpdate } from "@/lib/events";
import { publicCallerFromSnapshot, type BroadcastSnapshot } from "@/lib/public-show";
import { transitionShow } from "@/lib/show-state";
import type { StudioControlAction } from "@/lib/schemas";

export async function getBroadcastSnapshot(showId: string): Promise<BroadcastSnapshot> {
  const show = await prisma.show.findUniqueOrThrow({
    where: { id: showId },
    select: {
      id: true,
      title: true,
      broadcastState: true,
      updatedAt: true,
      currentQueueItemId: true,
      currentVisualAssetId: true,
    },
  });

  const current = show.currentQueueItemId
    ? await prisma.queueItem.findUnique({
        where: { id: show.currentQueueItemId },
        select: { callerSnapshot: true },
      })
    : null;

  return {
    showId: show.id,
    title: show.title,
    broadcastState: show.broadcastState,
    updatedAt: show.updatedAt.toISOString(),
    caller: current ? publicCallerFromSnapshot(current.callerSnapshot, show.currentVisualAssetId) : null,
  };
}

export async function canViewBroadcast(showId: string, token?: string) {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: { broadcastPublic: true, broadcastToken: true },
  });
  return Boolean(show && (show.broadcastPublic || (token && token === show.broadcastToken)));
}

export async function applyShowControl(showId: string, action: StudioControlAction) {
  await prisma.$transaction(async (tx) => {
    const show = await tx.show.findUniqueOrThrow({ where: { id: showId } });
    const current = show.currentQueueItemId
      ? await tx.queueItem.findUnique({ where: { id: show.currentQueueItemId } })
      : null;
    const next = action === "CUE_NEXT"
      ? await tx.queueItem.findFirst({
          where: { showId, status: "QUEUED", isReserve: false },
          orderBy: { position: "asc" },
        })
      : null;

    const transition = transitionShow(
      { showStatus: show.status, broadcastState: show.broadcastState, queueStatus: current?.status ?? null },
      action,
      Boolean(next),
    );

    let currentQueueItemId = show.currentQueueItemId;
    const now = new Date();

    if (action === "CUE_NEXT" && next) {
      await tx.queueItem.update({ where: { id: next.id }, data: { status: "CONNECTING" } });
      currentQueueItemId = next.id;
    }
    if (action === "MOCK_CONNECT" && current) {
      await tx.queueItem.update({ where: { id: current.id }, data: { status: "LIVE", startedAt: current.startedAt ?? now } });
    }
    if (["END_CALL", "CALLER_HANGS_UP"].includes(action) && current) {
      await tx.queueItem.update({ where: { id: current.id }, data: { status: "COMPLETED", endedAt: now } });
    }
    if (action === "SKIP_CALLER" && current) {
      await tx.queueItem.update({ where: { id: current.id }, data: { status: "SKIPPED", endedAt: now } });
    }
    if (action === "EMERGENCY_STOP" && current && ["CONNECTING", "LIVE"].includes(current.status)) {
      await tx.queueItem.update({ where: { id: current.id }, data: { status: "FAILED", endedAt: now } });
    }

    await tx.show.update({
      where: { id: showId },
      data: {
        status: transition.showStatus,
        broadcastState: transition.broadcastState,
        currentQueueItemId,
        ...(action === "START_SHOW" ? { startedAt: now } : {}),
        ...(action === "END_SHOW" ? { endedAt: now } : {}),
      },
    });

    await tx.showEvent.create({
      data: {
        showId,
        type: transition.eventType,
        payload: {
          action,
          currentQueueItemId,
          queueStatus: action === "MOCK_CONNECT" ? "LIVE" : (current?.status ?? next?.status ?? null),
        } as Prisma.InputJsonValue,
      },
    });
  });

  const snapshot = await getBroadcastSnapshot(showId);
  publishShowUpdate(showId, snapshot);
  return snapshot;
}

export async function reorderShowQueue(showId: string, queueItemIds: string[]) {
  await prisma.$transaction(async (tx) => {
    const items = await tx.queueItem.findMany({ where: { showId }, orderBy: { position: "asc" }, select: { id: true, position: true } });
    if (items.length !== queueItemIds.length) throw new Error("The running order changed. Refresh and try again.");
    const knownIds = new Set(items.map((item) => item.id));
    if (queueItemIds.some((id) => !knownIds.has(id))) throw new Error("The caller order contains an item from another show.");

    const offset = Math.max(...items.map((item) => item.position), 0) + items.length + 1;
    await tx.queueItem.updateMany({ where: { showId }, data: { position: { increment: offset } } });
    for (const [index, id] of queueItemIds.entries()) {
      await tx.queueItem.update({ where: { id }, data: { position: index + 1 } });
    }
    await tx.showEvent.create({ data: { showId, type: "QUEUE_REORDERED", payload: { queueItemIds } as Prisma.InputJsonValue } });
  });

  publishShowUpdate(showId, await getBroadcastSnapshot(showId));
}

export async function queueApprovedCaller(showId: string, callerId: string) {
  // Queue position is unique per show. Retry a collision so two producers can
  // safely append at nearly the same time.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const queueItem = await prisma.$transaction(async (tx) => {
        const [show, caller, last] = await Promise.all([
          tx.show.findUniqueOrThrow({ where: { id: showId }, select: { id: true } }),
          tx.caller.findUniqueOrThrow({ where: { id: callerId }, include: { assets: true } }),
          tx.queueItem.findFirst({ where: { showId }, orderBy: { position: "desc" }, select: { position: true } }),
        ]);
        if (caller.status !== "APPROVED") throw new Error("Only manually approved callers may enter the live queue.");

        return tx.queueItem.create({
          data: {
            showId: show.id,
            callerId,
            position: (last?.position ?? 0) + 1,
            callerSnapshot: createCallerSnapshot(caller) as Prisma.InputJsonValue,
          },
        });
      });

      // The host studio receives this immediately through its existing event stream.
      publishShowUpdate(showId, await getBroadcastSnapshot(showId));
      return queueItem;
    } catch (error) {
      const retryableCollision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!retryableCollision || attempt === 2) throw error;
    }
  }
  throw new Error("Unable to add caller to the queue.");
}

export async function reactivateQueueItem(showId: string, queueItemId: string) {
  await prisma.$transaction(async (tx) => {
    const [show, item] = await Promise.all([
      tx.show.findUniqueOrThrow({ where: { id: showId }, select: { status: true, broadcastState: true } }),
      tx.queueItem.findUniqueOrThrow({ where: { id: queueItemId }, select: { showId: true, status: true } }),
    ]);
    if (item.showId !== showId) throw new Error("Caller does not belong to this show.");
    if (!["COMPLETED", "SKIPPED", "FAILED"].includes(item.status)) throw new Error("Only finished callers can be reactivated.");
    await tx.queueItem.update({ where: { id: queueItemId }, data: { status: "QUEUED", startedAt: null, endedAt: null } });
    if (show.status === "ENDED" || show.broadcastState === "SHOW_ENDED") {
      await tx.show.update({
        where: { id: showId },
        data: { status: "READY", broadcastState: "SHOW_IDLE", currentQueueItemId: null, currentVisualAssetId: null, endedAt: null },
      });
    }
  });
  publishShowUpdate(showId, await getBroadcastSnapshot(showId));
}

const replayableBroadcastStates = new Set(["SHOW_IDLE", "CALLER_ENDED", "SHOW_BREAK", "SHOW_ENDED"]);

export function canResetShowForReplay(broadcastState: string) {
  return replayableBroadcastStates.has(broadcastState);
}

export async function resetShowForReplay(showId: string) {
  await prisma.$transaction(async (tx) => {
    const show = await tx.show.findUniqueOrThrow({ where: { id: showId } });
    if (!canResetShowForReplay(show.broadcastState)) {
      throw new Error("End the active caller before resetting this running order.");
    }
    const activeItems = await tx.queueItem.count({ where: { showId, status: { in: ["CONNECTING", "LIVE"] } } });
    if (activeItems > 0) throw new Error("End the active caller before resetting this running order.");

    await tx.queueItem.updateMany({
      where: { showId, status: { in: ["COMPLETED", "SKIPPED", "FAILED"] } },
      data: { status: "QUEUED", startedAt: null, endedAt: null },
    });
    await tx.show.update({
      where: { id: showId },
      data: {
        status: "READY",
        broadcastState: "SHOW_IDLE",
        currentQueueItemId: null,
        currentVisualAssetId: null,
        startedAt: null,
        endedAt: null,
      },
    });
    await tx.showEvent.create({
      data: {
        showId,
        type: "SHOW_RESET",
        payload: { action: "RESET_FOR_REHEARSAL" } as Prisma.InputJsonValue,
      },
    });
  });

  const snapshot = await getBroadcastSnapshot(showId);
  publishShowUpdate(showId, snapshot);
  return snapshot;
}

export async function applyBroadcastVisual(showId: string, assetId: string | null) {
  await prisma.$transaction(async (tx) => {
    const show = await tx.show.findUniqueOrThrow({ where: { id: showId } });
    const current = show.currentQueueItemId ? await tx.queueItem.findUnique({ where: { id: show.currentQueueItemId } }) : null;
    if (assetId) {
      if (!current) throw new Error("A caller must be selected before a visual can be shown.");
      const snapshot = callerSnapshotSchema.parse(current.callerSnapshot);
      const asset = snapshot.assets.find((candidate) => candidate.id === assetId && candidate.type === "SUPPORTING_VISUAL");
      if (!asset) {
        // A producer may add a prepared visual after the caller has already been
        // queued. Copy that safe, public asset into this queue snapshot so it is
        // available instantly without exposing any other later caller edits.
        const latestAsset = await tx.callerAsset.findFirst({
          where: { id: assetId, callerId: current.callerId, type: "SUPPORTING_VISUAL" },
        });
        if (!latestAsset) throw new Error("That visual does not belong to the active caller.");
        await tx.queueItem.update({
          where: { id: current.id },
          data: {
            callerSnapshot: {
              ...snapshot,
              assets: [...snapshot.assets, {
                id: latestAsset.id,
                type: latestAsset.type,
                label: latestAsset.label,
                url: latestAsset.url,
                trigger: latestAsset.trigger,
                manualHotkey: latestAsset.manualHotkey,
                priority: latestAsset.priority,
              }],
            } as Prisma.InputJsonValue,
          },
        });
      }
    }
    await tx.show.update({ where: { id: showId }, data: { currentVisualAssetId: assetId } });
    await tx.showEvent.create({
      data: {
        showId,
        type: assetId ? "VISUAL_SHOWN" : "VISUAL_CLEARED",
        payload: (assetId ? { assetId } : { reason: "host_clear" }) as Prisma.InputJsonValue,
      },
    });
  });
  const snapshot = await getBroadcastSnapshot(showId);
  publishShowUpdate(showId, snapshot);
  return snapshot;
}

export function isTerminalQueueStatus(status: QueueItemStatus) {
  return ["COMPLETED", "SKIPPED", "FAILED"].includes(status);
}
