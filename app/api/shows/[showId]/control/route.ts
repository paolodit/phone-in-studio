import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { queueControlSchema } from "@/lib/schemas";
import { applyShowControl } from "@/lib/show-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { showId } = await params;
  try {
    const input = queueControlSchema.parse(await request.json());
    const snapshot = await applyShowControl(showId, input.action);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply show control.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
