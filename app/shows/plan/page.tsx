import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planContentSchema } from "@/lib/show-plan";
import { ShowPlanner } from "@/components/ShowPlanner";
import { StudioNav } from "@/components/StudioNav";

export default async function PlanShowPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  await requireAdmin();
  const { plan: id } = await searchParams;
  const plan = id ? await prisma.showPlan.findUnique({ where: { id } }) : null;
  if (id && !plan) notFound();
  const recent = await prisma.showPlan.findMany({ where: { acceptedShowId: null }, orderBy: { updatedAt: "desc" }, take: 8 });
  return <main className="shell"><StudioNav /><ShowPlanner key={plan?.id ?? "new"} initialPlan={plan ? { id: plan.id, brief: plan.brief, durationMinutes: plan.durationMinutes, revision: plan.revision, acceptedShowId: plan.acceptedShowId, content: planContentSchema.parse(plan.content) } : null} recent={recent.map((item) => ({ id: item.id, title: planContentSchema.parse(item.content).title }))} /></main>;
}
