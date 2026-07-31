import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { fishApiKey, FishSessionError, loadFishCallerContext } from "@/lib/fish-audio";
import { realtimeSessionRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = realtimeSessionRequestSchema.parse(await request.json());
    if (!fishApiKey()) {
      return NextResponse.json({ error: "Fish Audio is not configured. Add FISH_API_KEY to .env.local, then restart the local server." }, { status: 503 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Fish Audio supplies speech, but this route still needs OPENAI_API_KEY for the caller's dialogue." }, { status: 503 });
    }
    const context = await loadFishCallerContext(input);
    return NextResponse.json({
      model: context.model,
      latency: context.latency,
      hasSelectedVoice: Boolean(context.voiceReferenceId),
      turnMode: "conservative_vad",
    });
  } catch (error) {
    const status = error instanceof FishSessionError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare the Fish Audio caller." }, { status });
  }
}
