import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { callerStructuredData, createCallerSnapshot } from "@/lib/caller";
import { generatedDraftToCallerForm } from "@/lib/caller-generation";
import { buildShowFormatConfig } from "@/lib/show-format";
import { planContentSchema, planTiming } from "@/lib/show-plan";

export class PlanConflict extends Error {}

export async function approveShowPlan(id: string, revision: number) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.showPlan.findUniqueOrThrow({ where: { id } });
    if (plan.acceptedShowId) return plan.acceptedShowId;
    const content = planContentSchema.parse(plan.content);
    const timing = planTiming(content, plan.durationMinutes);
    if (!timing.count) throw new PlanConflict("Keep at least one caller before creating the show.");
    if (timing.remainingMinutes < 0) throw new PlanConflict("The caller timings exceed the show length. Shorten a call before creating the show.");
    const lock = await tx.showPlan.updateMany({ where: { id, revision, acceptedShowId: null }, data: { revision: { increment: 1 } } });
    if (!lock.count) {
      const latest = await tx.showPlan.findUniqueOrThrow({ where: { id } });
      if (latest.acceptedShowId) return latest.acceptedShowId;
      throw new PlanConflict("This plan changed in another window. Reload it before approving.");
    }
    const show = await tx.show.create({ data: {
      title: content.title, status: "READY",
      brandingConfig: { ...buildShowFormatConfig({ title: content.title }), showPlan: { brief: plan.brief, synopsis: content.synopsis, durationMinutes: plan.durationMinutes } } as Prisma.InputJsonValue,
    } });
    for (const [index, slot] of content.slots.filter((item) => item.keep).entries()) {
      const form = generatedDraftToCallerForm(slot.draft);
      const structured = callerStructuredData(form);
      const caller = await tx.caller.create({ data: {
        firstName: form.firstName, surnameInitial: form.surnameInitial, age: form.age, location: form.location,
        occupation: form.occupation, relationshipStatus: form.relationshipStatus, issueHeadline: form.issueHeadline, openingSummary: form.openingSummary,
        character: structured.character as Prisma.InputJsonValue, story: structured.story as Prisma.InputJsonValue,
        performance: structured.performance as Prisma.InputJsonValue, hostSupport: structured.hostSupport as Prisma.InputJsonValue,
        status: "APPROVED", approvedAt: new Date(), approvedBy: "local-admin",
        generation: { source: "SHOW_PLANNER", planId: id, topicTags: slot.draft.topicTags, reasonTonight: slot.reasonTonight, visualIdea: slot.visualIdea } as Prisma.InputJsonValue,
      }, include: { assets: true } });
      await tx.queueItem.create({ data: { showId: show.id, callerId: caller.id, position: index + 1, callerSnapshot: createCallerSnapshot(caller) as Prisma.InputJsonValue, producerNote: `${slot.role} · about ${slot.minutes} min. ${slot.reasonTonight}\nVisual idea: ${slot.visualIdea}` } });
    }
    await tx.showPlan.update({ where: { id }, data: { acceptedShowId: show.id } });
    return show.id;
  }, { timeout: 20000 });
}
