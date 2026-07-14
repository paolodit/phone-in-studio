import { strict as assert } from "node:assert";
import { Prisma } from "../generated/prisma/client";
import { createCallerSnapshot } from "../lib/caller";
import { prisma } from "../lib/prisma";
import { applyBroadcastVisual, applyShowControl, reactivateQueueItem } from "../lib/show-service";

async function main() {
  // Never drive the user's actual development show during a health check.
  const caller = await prisma.caller.findFirstOrThrow({
    where: { status: "APPROVED", assets: { some: { type: "SUPPORTING_VISUAL" } } },
    include: { assets: true },
  });
  const show = await prisma.show.create({ data: { title: `Verification ${Date.now()}`, brandingConfig: { programmeName: "Verification" } } });

  try {
    await prisma.queueItem.create({
      data: {
        showId: show.id,
        callerId: caller.id,
        position: 1,
        callerSnapshot: createCallerSnapshot(caller) as Prisma.InputJsonValue,
      },
    });

    await applyShowControl(show.id, "START_SHOW");
    await applyShowControl(show.id, "CUE_NEXT");
    await applyShowControl(show.id, "ANSWER_CALL");
    const live = await applyShowControl(show.id, "MOCK_CONNECT");
    assert.equal(live.broadcastState, "CALLER_LIVE");
    assert.ok(live.caller, "A live caller must be present in the public snapshot.");

    const current = await prisma.show.findUniqueOrThrow({ where: { id: show.id }, select: { currentQueueItemId: true } });
    const liveQueueItem = await prisma.queueItem.findUniqueOrThrow({ where: { id: current.currentQueueItemId! }, include: { caller: { include: { assets: true } } } });
    const visual = liveQueueItem.caller.assets.find((asset) => asset.type === "SUPPORTING_VISUAL");
    assert.ok(visual, "Verification caller should have a supporting visual.");
    const withVisual = await applyBroadcastVisual(show.id, visual.id);
    assert.equal(withVisual.caller?.visual?.label, visual.label);
    const visualCleared = await applyBroadcastVisual(show.id, null);
    assert.equal(visualCleared.caller?.visual, undefined);

    const publicPayload = JSON.stringify(live);
    assert.ok(!publicPayload.includes("password"), "Private caller material must not enter the broadcast snapshot.");
    assert.ok(!publicPayload.includes("hiddenTruth"), "Hidden truths must not enter the broadcast snapshot.");

    await applyShowControl(show.id, "INTERRUPT_CALLER");
    const ended = await applyShowControl(show.id, "END_CALL");
    assert.equal(ended.broadcastState, "CALLER_ENDED");

    await reactivateQueueItem(show.id, current.currentQueueItemId!);
    const reactivated = await prisma.queueItem.findUniqueOrThrow({ where: { id: current.currentQueueItemId! }, select: { status: true } });
    assert.equal(reactivated.status, "QUEUED");
    const requeuedIncoming = await applyShowControl(show.id, "CUE_NEXT");
    assert.equal(requeuedIncoming.broadcastState, "CALLER_INCOMING");

    const events = await prisma.showEvent.findMany({ where: { showId: show.id }, select: { type: true } });
    for (const type of ["SHOW_STARTED", "CALLER_INCOMING", "CALLER_CONNECTING", "CALLER_CONNECTED", "CALLER_INTERRUPTED", "CALL_ENDED"]) {
      assert.ok(events.some((event) => event.type === type), `Expected ${type} to be persisted.`);
    }
    await prisma.showEvent.create({ data: { showId: show.id, type: "TRANSCRIPT_RECORDED", payload: { speaker: "CALLER", text: "A stored transcript check." } } });
    const transcript = await prisma.showEvent.findFirst({ where: { showId: show.id, type: "TRANSCRIPT_RECORDED" }, orderBy: { timestamp: "desc" } });
    assert.equal((transcript?.payload as { text?: string }).text, "A stored transcript check.");
    console.log("Verified an isolated mocked incoming → live → interrupted → ended show flow.");
  } finally {
    await prisma.show.delete({ where: { id: show.id } });
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
