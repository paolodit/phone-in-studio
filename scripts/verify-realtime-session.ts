import dotenv from "dotenv";
import { prisma } from "../lib/prisma";
import { buildRealtimeSessionConfig } from "../lib/realtime-session";

dotenv.config({ path: ".env.local" });

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set in .env.local.");
  const caller = await prisma.caller.findFirstOrThrow({ where: { status: "APPROVED" }, include: { assets: true } });
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ session: { type: "realtime", ...buildRealtimeSessionConfig(caller) } }),
  });
  const body = await response.json().catch(() => null) as { model?: string; value?: string; expires_at?: number; client_secret?: { value?: string; expires_at?: number }; error?: { message?: string } } | null;
  const clientSecret = body?.value ?? body?.client_secret?.value;
  const expiresAt = body?.expires_at ?? body?.client_secret?.expires_at;
  if (!response.ok || !clientSecret) throw new Error(body?.error?.message ?? `Realtime session setup failed with HTTP ${response.status}.`);
  console.log(`Verified Realtime session setup for model ${body?.model ?? "configured model"}; temporary credential expires at ${new Date((expiresAt ?? 0) * 1000).toISOString()}.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
