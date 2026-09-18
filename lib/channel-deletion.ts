import { prisma } from "@/lib/prisma";
import { publishShowDeleted } from "@/lib/events";

export async function deleteChannel(showId: string, confirmation: string) {
  await prisma.$transaction(async (tx) => {
    const show = await tx.show.findUnique({ where: { id: showId }, select: { title: true, status: true } });
    if (!show) throw new Error("This channel has already been deleted. Return to Channels.");
    if (confirmation !== show.title) throw new Error("Type the channel name exactly to confirm deletion.");
    if (show.status === "LIVE") throw new Error("End this show in Studio before deleting its channel.");
    const result = await tx.show.deleteMany({ where: { id: showId, title: confirmation, status: { not: "LIVE" } } });
    if (!result.count) throw new Error("The channel changed or went live. Refresh before deleting it.");
    // Queue, events, cues and per-show settings cascade. Library callers and
    // presenters stay; factory batches are detached by the existing SetNull FK.
    await tx.showPlan.updateMany({ where: { acceptedShowId: showId }, data: { acceptedShowId: null, revision: { increment: 1 } } });
  });
  publishShowDeleted(showId);
}
