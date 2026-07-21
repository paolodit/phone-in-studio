import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { generateHostTurn } from "@/lib/ai-host";
import { showModuleEnabled } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { aiHostTurnSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = aiHostTurnSchema.parse(await request.json());
    if (input.testMode) {
      const profile = await prisma.hostProfile.findUniqueOrThrow({ where: { id: input.profileId } });
      return NextResponse.json({ text: await generateHostTurn({ profile, transcript: input.transcript, intent: input.intent }) });
    }
    if (!input.showId || !input.callerId || !(await showModuleEnabled(input.showId, "AI_HOST"))) return NextResponse.json({ error: "AI Host is not enabled for this show." }, { status: 403 });
    const show = await prisma.show.findUniqueOrThrow({ where: { id: input.showId }, include: { hostProfile: true } });
    if (!["AI_SUPERVISED", "AI_AUTONOMOUS"].includes(show.hostMode) || !show.hostProfile) return NextResponse.json({ error: "Choose a host profile and an AI Host mode in Show Options." }, { status: 409 });
    const caller = await prisma.caller.findUniqueOrThrow({ where: { id: input.callerId } });
    const text = await generateHostTurn({ profile: show.hostProfile, show, caller, transcript: input.transcript, intent: input.intent });
    return NextResponse.json({ text, profileId: show.hostProfile.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare the AI Host turn." }, { status: 400 });
  }
}
