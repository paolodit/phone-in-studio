import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { fishApiKey, FishSessionError, loadFishCallerContext } from "@/lib/fish-audio";
import { realtimeSessionRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = await request.formData();
    const session = realtimeSessionRequestSchema.parse({
      showId: input.get("showId"),
      callerId: input.get("callerId"),
      testMode: input.get("testMode") === "true",
    });
    await loadFishCallerContext(session);
    const audio = input.get("audio");
    if (!(audio instanceof File) || !audio.size) return NextResponse.json({ error: "No host speech was captured." }, { status: 400 });
    if (audio.size > 15_000_000) return NextResponse.json({ error: "That host turn is too long. Keep each contribution under about 25 seconds." }, { status: 413 });
    const apiKey = fishApiKey();
    if (!apiKey) return NextResponse.json({ error: "Fish Audio is not configured. Add FISH_API_KEY and restart the server." }, { status: 503 });
    const body = new FormData();
    body.append("audio", audio, audio.name || "host-turn.webm");
    body.append("language", "en");
    body.append("ignore_timestamps", "true");
    const response = await fetch("https://api.fish.audio/v1/asr", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    });
    const payload = await response.json().catch(() => null) as { text?: string; message?: string } | null;
    if (!response.ok) {
      return NextResponse.json({
        error: payload?.message ? `Fish Audio could not hear the host: ${payload.message}` : "Fish Audio could not transcribe the host turn.",
      }, { status: response.status === 401 || response.status === 402 || response.status === 422 ? response.status : 502 });
    }
    return NextResponse.json({ text: payload?.text?.trim() ?? "" });
  } catch (error) {
    const status = error instanceof FishSessionError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to transcribe the host turn." }, { status });
  }
}
