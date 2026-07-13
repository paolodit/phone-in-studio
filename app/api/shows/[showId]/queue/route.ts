import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { queueReorderSchema } from "@/lib/schemas";
import { reorderShowQueue } from "@/lib/show-service";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { showId } = await params;
  try {
    const input = queueReorderSchema.parse(await request.json());
    await reorderShowQueue(showId, input.queueItemIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reorder callers." }, { status: 400 });
  }
}
