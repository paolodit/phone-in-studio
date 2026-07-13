import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transcriptEntrySchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  await requireAdmin();
  const { showId } = await params;
  const entry = transcriptEntrySchema.parse(await request.json());
  await prisma.showEvent.create({ data: { showId, type: "TRANSCRIPT_RECORDED", payload: entry } });
  return NextResponse.json({ ok: true });
}
