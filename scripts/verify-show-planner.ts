import { prisma } from "../lib/prisma";
import { approveShowPlan } from "../lib/show-plan-service";
import { planFixture } from "../tests/fixtures/show-plan";
import { randomUUID } from "node:crypto";
// This verification owns only the temporary plan, show and caller it creates.
const before = await prisma.caller.count();
const content = { ...planFixture, slots: [...planFixture.slots, { ...planFixture.slots[0], id: randomUUID(), keep: false }] };
const plan = await prisma.showPlan.create({ data: { brief: "Automated isolated verification, not a production show.", durationMinutes: 20, content } });
try {
  if (await prisma.caller.count() !== before) throw new Error("Drafting a plan created a caller.");
  let staleRejected = false;
  try { await approveShowPlan(plan.id, plan.revision + 1); } catch { staleRejected = true; }
  if (!staleRejected || await prisma.caller.count() !== before) throw new Error("A stale approval was accepted or created callers.");
  const [showId, simultaneous] = await Promise.all([approveShowPlan(plan.id, plan.revision), approveShowPlan(plan.id, plan.revision)]);
  if (simultaneous !== showId) throw new Error("Concurrent approval was not idempotent.");
  const repeated = await approveShowPlan(plan.id, plan.revision);
  if (repeated !== showId) throw new Error("Approval was not idempotent.");
  const show = await prisma.show.findUniqueOrThrow({ where: { id: showId }, include: { queueItems: true } });
  if (show.status !== "READY" || show.broadcastState !== "SHOW_IDLE" || show.queueItems.length !== 1) throw new Error("Unexpected approval state.");
  if (await prisma.caller.count() !== before + 1) throw new Error("Approval created unexpected callers.");
  console.log("PASS: private draft creates no callers; approval creates one off-air ready show and selected caller; repeated and concurrent approval are idempotent.");
} finally {
  const saved = await prisma.showPlan.findUnique({ where: { id: plan.id } });
  if (saved?.acceptedShowId) {
    const ids = (await prisma.queueItem.findMany({ where: { showId: saved.acceptedShowId }, select: { callerId: true } })).map((item) => item.callerId);
    await prisma.show.delete({ where: { id: saved.acceptedShowId } });
    await prisma.caller.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.showPlan.delete({ where: { id: plan.id } }); await prisma.$disconnect();
}
