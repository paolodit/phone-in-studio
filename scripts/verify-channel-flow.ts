import { strict as assert } from "node:assert";
import { prisma } from "../lib/prisma";
import { createChannel } from "../lib/channel-creation";
import { deleteChannel } from "../lib/channel-deletion";
import { starterPacks, type StarterPack } from "../lib/starter-packs";
import { readyTestPack } from "../tests/fixtures/starter-pack";
import { readBackgroundMusic } from "../lib/background-music";
import { getBroadcastSnapshot, applyShowControl } from "../lib/show-service";
import { subscribeToShowDeleted } from "../lib/events";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://localhost/invalid");
if (!/^phone_in_channel_test_[a-f0-9]{16}$/.test(database.searchParams.get("schema") ?? "")) throw new Error("Use the .mjs wrapper; this test requires its own throwaway schema.");
try {
  assert.equal(await prisma.show.count(), 0);
  const blank = await createChannel({ title: "First custom channel", mode: "custom" });
  assert.equal(await prisma.caller.count(), 0);
  assert.equal(readBackgroundMusic(blank.brandingConfig).enabled, false);
  await deleteChannel(blank.id, blank.title);
  assert.equal(await prisma.show.count(), 0, "Deleting the last channel returns to the empty creation state.");

  const humanPack = readyTestPack();
  const autoPack = readyTestPack("auto");
  // Test-local registry only; the running app's catalogue is never changed.
  (starterPacks as StarterPack[]).push(humanPack, autoPack);
  const human = await createChannel({ title: "Human starter test", mode: "human", packId: humanPack.id });
  assert.equal(await prisma.queueItem.count({ where: { showId: human.id } }), 6);
  assert.equal(readBackgroundMusic(human.brandingConfig).enabled, true);
  const first = await prisma.queueItem.findFirstOrThrow({ where: { showId: human.id }, orderBy: { position: "asc" }, include: { caller: { include: { assets: true } } } });
  assert.ok(first.caller.assets.some((asset) => asset.type === "SUPPORTING_VISUAL" && asset.creditText === "Test fixture"));
  await prisma.caller.update({ where: { id: first.callerId }, data: { openingSummary: "A user-customised opening which must survive future template updates." } });
  humanPack.version += 1;
  humanPack.cast[0].caller.openingSummary = "A different future template opening that should not overwrite old callers.";
  const second = await createChannel({ title: "Second starter test", mode: "human", packId: humanPack.id });
  const secondFirst = await prisma.queueItem.findFirstOrThrow({ where: { showId: second.id }, orderBy: { position: "asc" } });
  assert.notEqual(first.callerId, secondFirst.callerId);
  assert.equal((await prisma.caller.findUniqueOrThrow({ where: { id: first.callerId } })).openingSummary, "A user-customised opening which must survive future template updates.");

  const auto = await createChannel({ title: "Auto starter test", mode: "auto", packId: autoPack.id });
  assert.equal(auto.hostMode, "AI_AUTONOMOUS"); assert.equal(auto.status, "READY"); assert.equal(auto.broadcastState, "SHOW_IDLE");
  assert.equal(await prisma.queueItem.count({ where: { showId: auto.id } }), 5);
  assert.ok(auto.hostProfileId);
  assert.equal((await prisma.optionalModuleSetting.findUniqueOrThrow({ where: { key: "AI_HOST" } })).enabled, true);

  await applyShowControl(human.id, "START_SHOW");
  await assert.rejects(() => deleteChannel(human.id, human.title), /End this show/);
  await applyShowControl(human.id, "CUE_NEXT"); await applyShowControl(human.id, "ANSWER_CALL"); await applyShowControl(human.id, "MOCK_CONNECT");
  const snapshot = await getBroadcastSnapshot(human.id);
  assert.equal(snapshot.visualPlaylist?.visuals[0].creditText, "Test fixture");
  assert.ok(!JSON.stringify(snapshot).includes("hiddenTruth"));
  await applyShowControl(human.id, "END_SHOW");

  const batch = await prisma.callerGenerationBatch.create({ data: { showId: human.id, title: "Retained test batch", seed: "test", targetCount: 10 } });
  const plan = await prisma.showPlan.create({ data: { brief: "Saved test plan", durationMinutes: 20, content: {}, acceptedShowId: human.id } });
  await prisma.soundEffect.create({ data: { showId: human.id, label: "Test cue", url: "/audio/effects/cheer.mp3" } });
  let notified = false; const off = subscribeToShowDeleted(human.id, () => { notified = true; });
  await assert.rejects(() => deleteChannel(human.id, "Wrong name"), /exactly/);
  await deleteChannel(human.id, human.title); off(); assert.ok(notified);
  assert.equal(await prisma.queueItem.count({ where: { showId: human.id } }), 0);
  assert.equal(await prisma.showEvent.count({ where: { showId: human.id } }), 0);
  assert.equal(await prisma.soundEffect.count({ where: { showId: human.id } }), 0);
  assert.ok(await prisma.caller.findUnique({ where: { id: first.callerId } }));
  assert.equal((await prisma.callerGenerationBatch.findUniqueOrThrow({ where: { id: batch.id } })).showId, null);
  assert.equal((await prisma.showPlan.findUniqueOrThrow({ where: { id: plan.id } })).acceptedShowId, null);
  assert.ok(await prisma.show.findUnique({ where: { id: second.id } }));
  await deleteChannel(auto.id, auto.title);
  assert.ok(await prisma.hostProfile.findUnique({ where: { id: auto.hostProfileId! } }));
  assert.equal(await prisma.showModuleSetting.count({ where: { showId: auto.id } }), 0);
  console.log("Verified isolated first/last channel, 6/5 guest packs, independent copies, media defaults/credits, off-air auto-host setup, live deletion protection, cascades, retained callers/profiles/plans/batches and deletion notifications. No voice or stock API calls.");
} finally { await prisma.$disconnect(); }
