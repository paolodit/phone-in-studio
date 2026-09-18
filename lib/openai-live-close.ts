import { createHmac, timingSafeEqual } from "node:crypto";

function signature(value: string) {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required.");
  return createHmac("sha256", process.env.AUTH_SECRET).update(`live-close:${value}`).digest("base64url");
}

export function createLiveCloseToken(sessionId: string, now = Date.now()) {
  const value = Buffer.from(JSON.stringify({ sessionId, expiresAt: now + 12 * 60 * 60 * 1000 })).toString("base64url");
  return `${value}.${signature(value)}`;
}

export function readLiveCloseToken(token: string, now = Date.now()): string | null {
  try {
    const [value, supplied, extra] = token.split(".");
    if (!value || !supplied || extra) return null;
    const expected = Buffer.from(signature(value));
    const actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return typeof data.sessionId === "string" && data.sessionId.length <= 200 && typeof data.expiresAt === "number" && data.expiresAt > now ? data.sessionId : null;
  } catch { return null; }
}

export async function hangupOpenAILiveSession(sessionId: string) {
  const response = await fetch(`https://api.openai.com/v1/live/sessions/${encodeURIComponent(sessionId)}/hangup`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(10_000),
  });
  return response.ok || response.status === 404 || response.status === 410;
}
