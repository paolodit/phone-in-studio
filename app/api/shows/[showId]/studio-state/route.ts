import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStudioState } from "@/lib/studio-state";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ showId: string }> }) {
  await requireAdmin();
  const { showId } = await params;
  return NextResponse.json(await getStudioState(showId));
}
