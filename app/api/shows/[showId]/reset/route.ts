import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { resetShowForReplay } from "@/lib/show-service";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ showId: string }> }) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { showId } = await params;
  try {
    return NextResponse.json(await resetShowForReplay(showId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reset the running order." }, { status: 400 });
  }
}
