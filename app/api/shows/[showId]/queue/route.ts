import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { queueCallerSchema, queueReactivateSchema, queueReorderSchema } from "@/lib/schemas";
import { queueApprovedCaller, reactivateQueueItem, reorderShowQueue } from "@/lib/show-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { showId } = await params;
  try {
    const input = queueCallerSchema.parse(await request.json());
    const queueItem = await queueApprovedCaller(showId, input.callerId);
    return NextResponse.json({ queueItemId: queueItem.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add caller to the live queue." }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { showId } = await params;
  try {
    const input = queueReactivateSchema.parse(await request.json());
    await reactivateQueueItem(showId, input.queueItemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reactivate caller." }, { status: 400 });
  }
}

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
