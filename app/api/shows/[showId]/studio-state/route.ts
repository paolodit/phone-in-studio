import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStudioState } from "@/lib/studio-state";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ showId: string }> }) {
  await requireAdmin();
  const { showId } = await params;
  try { return NextResponse.json(await getStudioState(showId)); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Channel no longer exists." }, { status: 404 });
    throw error;
  }
}
