import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { publishShowAudioLevels } from "@/lib/events";
import { audioLevelsSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { showId } = await params;
  try {
    publishShowAudioLevels(showId, audioLevelsSchema.parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send caller audio level." }, { status: 400 });
  }
}
