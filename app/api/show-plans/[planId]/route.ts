import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planContentSchema } from "@/lib/show-plan";
import { replacePlanSlot } from "@/lib/show-plan-generation";
import { approveShowPlan, PlanConflict } from "@/lib/show-plan-service";
import { CallerWorkshopError } from "@/lib/caller-generation";

const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), revision: z.number().int().nonnegative(), content: planContentSchema }),
  z.object({ action: z.literal("swap"), revision: z.number().int().nonnegative(), slotId: z.string().uuid() }),
  z.object({ action: z.literal("approve"), revision: z.number().int().nonnegative() }),
]);
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  await requireAdmin();
  const { planId } = await params;
  try {
    const input = commandSchema.parse(await request.json());
    if (input.action === "approve") return NextResponse.json({ showId: await approveShowPlan(planId, input.revision) });
    const plan = await prisma.showPlan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    if (plan.acceptedShowId || plan.revision !== input.revision) throw new PlanConflict("This plan was updated or already used. Reload to see the latest version.");
    const content = input.action === "save" ? input.content : await replacePlanSlot(plan.brief, planContentSchema.parse(plan.content), input.slotId);
    const updated = await prisma.showPlan.updateMany({ where: { id: planId, revision: input.revision, acceptedShowId: null }, data: { content, revision: { increment: 1 } } });
    if (!updated.count) throw new PlanConflict("This plan changed while the request was running. Reload to see the saved version.");
    return NextResponse.json(await prisma.showPlan.findUniqueOrThrow({ where: { id: planId } }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof PlanConflict || error instanceof CallerWorkshopError ? error.message : error instanceof ZodError ? error.issues[0]?.message : "Could not update the plan. Nothing has been put on air." }, { status: error instanceof PlanConflict ? 409 : error instanceof ZodError ? 400 : 500 });
  }
}
