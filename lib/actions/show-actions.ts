"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { showSetupSchema, soundEffectFormSchema } from "@/lib/schemas";
import { buildShowFormatConfig } from "@/lib/show-format";
import { queueApprovedCaller, resetShowForReplay } from "@/lib/show-service";

export async function createShowAction(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3 || title.length > 120) throw new Error("Show title must be between 3 and 120 characters.");
  const show = await prisma.show.create({ data: { title, brandingConfig: buildShowFormatConfig({ title }) as Prisma.InputJsonValue } });
  redirect(`/shows/${show.id}`);
}

export async function updateShowAction(showId: string, formData: FormData) {
  await requireAdmin();
  const input = showSetupSchema.parse(Object.fromEntries(formData.entries()));
  const current = await prisma.show.findUniqueOrThrow({ where: { id: showId }, select: { brandingConfig: true } });
  await prisma.show.update({ where: { id: showId }, data: { title: input.title, brandingConfig: buildShowFormatConfig(input, current.brandingConfig) as Prisma.InputJsonValue } });
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/shows");
  revalidatePath("/studio");
}

export async function deleteShowAction(showId: string) {
  await requireAdmin();
  const show = await prisma.show.findUniqueOrThrow({ where: { id: showId }, select: { status: true } });
  if (show.status === "LIVE") throw new Error("End the live show before deleting its running order.");
  await prisma.show.delete({ where: { id: showId } });
  revalidatePath("/shows");
  revalidatePath("/studio");
  redirect("/shows");
}

export async function resetShowForReplayAction(showId: string) {
  await requireAdmin();
  await resetShowForReplay(showId);
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/shows");
  revalidatePath("/studio");
  redirect(`/studio?show=${showId}`);
}

export async function addSoundEffectAction(showId: string, formData: FormData) {
  await requireAdmin();
  const effect = soundEffectFormSchema.parse(Object.fromEntries(formData.entries()));
  await prisma.soundEffect.create({ data: { showId, ...effect } });
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/studio");
}

export async function deleteSoundEffectAction(showId: string, soundEffectId: string) {
  await requireAdmin();
  const effect = await prisma.soundEffect.findUniqueOrThrow({ where: { id: soundEffectId }, select: { showId: true } });
  if (effect.showId !== showId) throw new Error("Sound effect does not belong to this show.");
  await prisma.soundEffect.delete({ where: { id: soundEffectId } });
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/studio");
}

export async function addCallerToShowAction(showId: string, formData: FormData) {
  await requireAdmin();
  const callerId = String(formData.get("callerId") ?? "");
  await queueApprovedCaller(showId, callerId);
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/studio");
  revalidatePath("/callers");
}

export async function moveQueueItemAction(showId: string, queueItemId: string, direction: "up" | "down") {
  await requireAdmin();
  const item = await prisma.queueItem.findUniqueOrThrow({ where: { id: queueItemId } });
  if (item.showId !== showId) throw new Error("Queue item does not belong to this show.");
  const neighbour = await prisma.queueItem.findFirst({
    where: direction === "up" ? { showId, position: { lt: item.position } } : { showId, position: { gt: item.position } },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return;
  await prisma.$transaction([
    prisma.queueItem.update({ where: { id: item.id }, data: { position: -item.position } }),
    prisma.queueItem.update({ where: { id: neighbour.id }, data: { position: item.position } }),
    prisma.queueItem.update({ where: { id: item.id }, data: { position: neighbour.position } }),
    prisma.showEvent.create({ data: { showId, type: "QUEUE_REORDERED", payload: { queueItemId, direction } } }),
  ]);
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/studio");
}
