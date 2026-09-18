import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminSession } from "@/lib/auth";
import { updateVisualAutoplay } from "@/lib/show-service";

export const runtime = "nodejs";
const visualAutoplayRequest = z.object({ enabled: z.boolean(), intervalSeconds: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]) });

export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = visualAutoplayRequest.parse(await request.json());
    return NextResponse.json(await updateVisualAutoplay((await params).showId, input.enabled, input.intervalSeconds));
  } catch {
    return NextResponse.json({ error: "Unable to save image autoplay. Choose an interval from 5 to 30 seconds and retry." }, { status: 400 });
  }
}
