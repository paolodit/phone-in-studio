import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { buildFishTtsRequest, fishApiKey, FishSessionError, loadFishCallerContext } from "@/lib/fish-audio";
import { fishSpeechSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = fishSpeechSchema.parse(await request.json());
    const apiKey = fishApiKey();
    if (!apiKey) return NextResponse.json({ error: "Fish Audio is not configured. Add FISH_API_KEY and restart the server." }, { status: 503 });
    const context = await loadFishCallerContext(input);
    const speech = buildFishTtsRequest({
      text: input.text,
      voiceReferenceId: context.voiceReferenceId,
      pacing: context.pacing,
      model: context.model,
      latency: context.latency,
    });
    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        model: speech.model,
      },
      body: JSON.stringify(speech.body),
    });
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      return NextResponse.json({
        error: payload?.message ? `Fish Audio could not render the caller voice: ${payload.message}` : "Fish Audio could not render the caller voice. Check the API key, voice model ID and account balance.",
      }, { status: response.status === 401 || response.status === 402 || response.status === 422 ? response.status : 502 });
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Fish-Audio-Model": speech.model,
      },
    });
  } catch (error) {
    const status = error instanceof FishSessionError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to render the Fish Audio caller voice." }, { status });
  }
}
