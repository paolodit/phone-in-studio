import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { showBriefSchema } from "@/lib/show-plan";
import { generateShowPlan } from "@/lib/show-plan-generation";
import { CallerWorkshopError } from "@/lib/caller-generation";

export const runtime = "nodejs";
export async function POST(request: Request) {
  await requireAdmin();
  try {
    const input = showBriefSchema.parse(await request.json());
    const content = await generateShowPlan(input);
    const plan = await prisma.showPlan.create({ data: { brief: input.brief, durationMinutes: input.durationMinutes, content } });
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ZodError ? error.issues[0]?.message : error instanceof CallerWorkshopError ? error.message : "Could not draft the line-up. Your existing plans have not changed." }, { status: error instanceof ZodError ? 400 : 502 });
  }
}
