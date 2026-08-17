import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { FishSessionError, generateFishCallerTurn, loadFishCallerContext } from "@/lib/fish-audio";
import { fishCallerTurnSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = fishCallerTurnSchema.parse(await request.json());
    const context = await loadFishCallerContext(input);
    const text = await generateFishCallerTurn({
      instructions: context.instructions,
      transcript: input.transcript,
      opening: input.opening,
      producerDirection: input.producerDirection,
    });
    return NextResponse.json({ text });
  } catch (error) {
    const status = error instanceof FishSessionError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare the Fish Audio caller's next turn." }, { status });
  }
}
