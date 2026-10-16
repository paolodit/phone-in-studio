import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hostedSleepEnabled, hostedIdleMs, idleGuard } from "@/lib/hosted-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!hostedSleepEnabled()) return new Response(null, { status: 404 });
  const expected = Buffer.from("Bearer " + (process.env.HOSTED_INSTANCE_TOKEN || ""));
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  if (!process.env.HOSTED_INSTANCE_TOKEN || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return new Response(null, { status: 401 });
  try {
    const raw = await request.text();
    if (raw.length > 300) return new Response(null, { status: 413 });
    const input = JSON.parse(raw);
    if (!/^[a-f0-9-]{36}$/.test(input.token || "") || !["prepare", "cancel", "wake"].includes(input.action))
      return new Response(null, { status: 400 });
    const accepted = input.action !== "prepare" ? idleGuard.cancel(input.token, input.action === "wake") :
      await idleGuard.prepare(input.token, hostedIdleMs(), async () => {
        const [shows, callers, jobs] = await Promise.all([
          // LIVE includes breaks and held calls. Never expire this protection.
          prisma.show.count({ where: { OR: [{ status: "LIVE" }, { broadcastState: { in: ["CALLER_INCOMING", "CALLER_CONNECTING", "CALLER_LIVE", "CALLER_ON_HOLD", "SHOW_BREAK"] } }] } }),
          prisma.queueItem.count({ where: { status: { in: ["CONNECTING", "LIVE"] } } }),
          prisma.callerGenerationBatch.count({ where: { status: "RUNNING" } }),
        ]);
        return shows + callers + jobs > 0;
      });
    return Response.json({ protocol: 2, accepted }, { status: accepted ? 200 : 409, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Studio safety check unavailable; keep running." }, { status: 503 });
  }
}
