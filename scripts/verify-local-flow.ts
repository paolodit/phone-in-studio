import { strict as assert } from "node:assert";
import { prisma } from "../lib/prisma";
import { applyBroadcastVisual, applyShowControl } from "../lib/show-service";

async function main() {
  const show = await prisma.show.findFirstOrThrow({ where: { title: "AI Phone-In — Development Show" } });

  await applyShowControl(show.id, "START_SHOW");
  await applyShowControl(show.id, "CUE_NEXT");
  await applyShowControl(show.id, "ANSWER_CALL");
  const live = await applyShowControl(show.id, "MOCK_CONNECT");
  assert.equal(live.broadcastState, "CALLER_LIVE");
  assert.ok(live.caller, "A live caller must be present in the public snapshot.");

  const liveQueueItem = await prisma.queueItem.findUniqueOrThrow({ where: { id: (await prisma.show.findUniqueOrThrow({ where: { id: show.id }, select: { currentQueueItemId: true } })).currentQueueItemId! }, include: { caller: { include: { assets: true } } } });
  const visual = liveQueueItem.caller.assets.find((asset) => asset.type === "SUPPORTING_VISUAL");
  assert.ok(visual, "Seeded caller should have a supporting visual.");
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

  const events = await prisma.showEvent.findMany({ where: { showId: show.id }, select: { type: true } });
  for (const type of ["SHOW_STARTED", "CALLER_INCOMING", "CALLER_CONNECTING", "CALLER_CONNECTED", "CALLER_INTERRUPTED", "CALL_ENDED"]) {
    assert.ok(events.some((event) => event.type === type), `Expected ${type} to be persisted.`);
  }
  await prisma.showEvent.create({ data: { showId: show.id, type: "TRANSCRIPT_RECORDED", payload: { speaker: "CALLER", text: "A stored transcript check." } } });
  const transcript = await prisma.showEvent.findFirst({ where: { showId: show.id, type: "TRANSCRIPT_RECORDED" }, orderBy: { timestamp: "desc" } });
  assert.equal((transcript?.payload as { text?: string }).text, "A stored transcript check.");
  console.log("Verified the mocked incoming → live → interrupted → ended show flow.");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
