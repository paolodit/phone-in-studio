import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { broadcastVisualSchema } from "@/lib/schemas";
import { applyBroadcastVisual } from "@/lib/show-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  await requireAdmin();
  const { showId } = await params;
  try {
    const { assetId } = broadcastVisualSchema.parse(await request.json());
    return NextResponse.json(await applyBroadcastVisual(showId, assetId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update the broadcast visual." }, { status: 400 });
  }
}
