import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { soundTriggerSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  await requireAdmin();
  const { showId } = await params;
  const { soundEffectId } = soundTriggerSchema.parse(await request.json());
  const effect = await prisma.soundEffect.findUniqueOrThrow({ where: { id: soundEffectId }, select: { id: true, showId: true, label: true } });
  if (effect.showId !== showId) return NextResponse.json({ error: "Sound cue does not belong to this show." }, { status: 403 });
  await prisma.showEvent.create({ data: { showId, type: "SOUND_EFFECT_PLAYED", payload: { soundEffectId: effect.id, label: effect.label } } });
  return NextResponse.json({ ok: true });
}
