import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/auth";
import { CallerWorkshopError, developCallerFromPremise } from "@/lib/caller-generation";
import { callerIdeaSeedSchema, callerPremiseSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await requireAdmin();
  try {
    const body = await request.json();
    const seed = callerIdeaSeedSchema.parse(body);
    const premise = callerPremiseSchema.parse(body.premise);
    return NextResponse.json({ draft: await developCallerFromPremise(seed, premise) });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the selected premise." }, { status: 400 });
    if (error instanceof CallerWorkshopError) {
      return NextResponse.json({ error: error.message }, { status: error.kind === "not_configured" ? 503 : 502 });
    }
    return NextResponse.json({ error: "Unable to develop this caller." }, { status: 500 });
  }
}
