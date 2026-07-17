import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/auth";
import { CallerWorkshopError, generateCallerPremises } from "@/lib/caller-generation";
import { callerIdeaSeedSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await requireAdmin();
  try {
    const seed = callerIdeaSeedSchema.parse(await request.json());
    return NextResponse.json({ premises: await generateCallerPremises(seed) });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the seed notes." }, { status: 400 });
    if (error instanceof CallerWorkshopError) {
      return NextResponse.json({ error: error.message }, { status: error.kind === "not_configured" ? 503 : 502 });
    }
    return NextResponse.json({ error: "Unable to generate premise options." }, { status: 500 });
  }
}
