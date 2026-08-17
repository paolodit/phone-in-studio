import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiHostSpeechSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = aiHostSpeechSchema.parse(await request.json());
    const [profile, apiKey] = await Promise.all([prisma.hostProfile.findUniqueOrThrow({ where: { id: input.profileId } }), Promise.resolve(process.env.OPENAI_API_KEY)]);
    if (!apiKey) return NextResponse.json({ error: "AI Host speech is not configured. Add OPENAI_API_KEY and restart the server." }, { status: 503 });
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_HOST_TTS_MODEL ?? "tts-1", voice: profile.voiceId, input: input.text, response_format: "mp3", speed: 1 }),
    });
    if (!response.ok) return NextResponse.json({ error: "The AI Host voice could not be rendered." }, { status: 502 });
    return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-AI-Voice": "true" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to render AI Host speech." }, { status: 400 });
  }
}
