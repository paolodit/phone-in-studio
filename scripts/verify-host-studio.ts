import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { createCallerSnapshot } from "../lib/caller";
import { applyShowControl, updateVisualAutoplay } from "../lib/show-service";

// Explicitly opt in: one short host text response plus speech synthesis costs
// provider credits. Never drives or changes the user's actual show.
const billable = process.argv.includes("--allow-billable");
if (!billable && !process.argv.includes("--offline")) {
  console.log("Usage: tsx scripts/verify-host-studio.ts --allow-billable [--browser]\nRequires the local app, DATABASE_URL and an already-enabled AI Host with a saved presenter. --browser retains the isolated fixture until Enter (or 5 minutes).");
  process.exit(0);
}

let showId: string | undefined;
try {
  assert.ok(process.env.AUTH_SECRET, "AUTH_SECRET is required for the local admin smoke test.");
  assert.ok((await prisma.optionalModuleSetting.findUnique({ where: { key: "AI_HOST" } }))?.enabled, "Enable AI Host before testing.");
  const profile = await prisma.hostProfile.findFirstOrThrow({ where: { active: true } });
  const caller = await prisma.caller.findFirstOrThrow({ where: { status: "APPROVED", assets: { some: { type: "SUPPORTING_VISUAL" } } }, include: { assets: { orderBy: { priority: "asc" } } } });
  const show = await prisma.show.create({ data: { title: "Isolated AI Host verification", brandingConfig: {}, hostMode: "AI_SUPERVISED", hostProfileId: profile.id, moduleSettings: { create: { key: "AI_HOST", enabled: true, config: {} } } } });
  showId = show.id;
  await prisma.queueItem.create({ data: { showId, callerId: caller.id, position: 1, callerSnapshot: createCallerSnapshot(caller) as Prisma.InputJsonValue } });
  for (const action of ["START_SHOW", "CUE_NEXT", "ANSWER_CALL", "MOCK_CONNECT"] as const) await applyShowControl(showId, action);
  const cookie = `ai-phone-in-session=admin.${createHmac("sha256", process.env.AUTH_SECRET!).update("admin").digest("base64url")}`;
  const post = (path: string, body: unknown) => fetch(`http://localhost:3000${path}`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(45_000) });
  if (billable) {
  const response = await post("/api/ai-host/respond", { showId, callerId: caller.id, transcript: [{ speaker: "CALLER", text: "Hello. This is a private technical test. Ask me one short question about my day." }] });
  const result = await response.json();
  assert.equal(response.status, 200, result.error);
  assert.ok(result.text && result.profileId === profile.id);
  const speech = await post("/api/ai-host/speech", { profileId: result.profileId, text: result.text });
  assert.equal(speech.status, 200);
  const bytes = (await speech.arrayBuffer()).byteLength;
  assert.ok(bytes > 1000, "Speech must contain real audio.");
  console.log(JSON.stringify({ hostRespond: response.status, hostSpeech: speech.status, audioBytes: bytes, replyCharacters: result.text.length, liveShowUntouched: true }));
  } else console.log("Offline fixture only: no OpenAI calls, audio sessions or microphone capture.");
  await updateVisualAutoplay(showId, true, 5);
  if (process.argv.includes("--browser")) {
    console.log(`TEST_STUDIO=http://localhost:3000/studio?show=${showId}`);
    console.log(`TEST_OUTPUT=http://localhost:3000/broadcast/${showId}?token=${show.broadcastToken}&mode=full&layout=web`);
    console.log("Press Enter after browser checks to remove this temporary show.");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { process.stdin.pause(); resolve(); }, 300_000);
      process.stdin.resume(); process.stdin.once("data", () => { clearTimeout(timer); process.stdin.pause(); resolve(); });
    });
  }
} finally {
  if (showId) await prisma.show.delete({ where: { id: showId } });
  await prisma.$disconnect();
  console.log("Isolated host verification show removed.");
}
