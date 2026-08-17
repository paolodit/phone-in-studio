"use server";

import { CallerStatus, Prisma } from "@/generated/prisma/client";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prepareAutomatedVisuals, readAutomatedVisualConfig } from "@/lib/auto-visuals";
import { callerStructuredData } from "@/lib/caller";
import { CALLER_WORKSHOP_PROMPT_VERSION, generatedDraftToCallerForm } from "@/lib/caller-generation";
import { moduleEnabled } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { callerFactoryBatchSchema, generatedCallerDraftSchema } from "@/lib/schemas";

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function requireFactory() {
  await requireAdmin();
  if (!(await moduleEnabled("CALLER_FACTORY"))) throw new Error("Caller Factory is disabled in Optional Modules.");
}

export async function createCallerBatchAction(formData: FormData) {
  await requireFactory();
  const input = callerFactoryBatchSchema.parse(Object.fromEntries(formData.entries()));
  const batch = await prisma.callerGenerationBatch.create({ data: {
    title: input.title,
    seed: input.seed,
    targetCount: input.targetCount,
    showId: input.showId,
    status: "DRAFT",
    criteria: { tone: input.tone, mix: input.mix, intensity: input.intensity, exclusions: input.exclusions ?? "", research: false } as Prisma.InputJsonValue,
  } });
  redirect(`/callers/factory/${batch.id}`);
}

async function acceptCandidate(candidateId: string) {
  const candidate = await prisma.callerCandidate.findUniqueOrThrow({ where: { id: candidateId }, include: { batch: { include: { show: { include: { moduleSettings: true } } } } } });
  if (candidate.status === "ACCEPTED") return candidate.acceptedCallerId;
  let draft = generatedCallerDraftSchema.parse(candidate.draft);
  const aiHostSetting = candidate.batch.show?.moduleSettings.find((setting) => setting.key === "AI_HOST");
  const automatedVisuals = aiHostSetting?.enabled
    ? readAutomatedVisualConfig(record(aiHostSetting.config), candidate.batch.show?.hostMode)
    : { policy: "OFF" as const, avoidPeople: true };
  if (automatedVisuals.policy !== "OFF" && draft.autoVisuals?.status !== "READY") {
    draft = { ...draft, autoVisuals: await prepareAutomatedVisuals(draft, automatedVisuals) };
  }
  const form = generatedDraftToCallerForm(draft);
  const structured = callerStructuredData(form);
  return prisma.$transaction(async (tx) => {
    const caller = await tx.caller.create({ data: {
      status: CallerStatus.DRAFT,
      firstName: form.firstName,
      surnameInitial: form.surnameInitial,
      age: form.age,
      location: form.location,
      occupation: form.occupation,
      relationshipStatus: form.relationshipStatus,
      issueHeadline: form.issueHeadline,
      openingSummary: form.openingSummary,
      character: structured.character as Prisma.InputJsonValue,
      story: structured.story as Prisma.InputJsonValue,
      performance: structured.performance as Prisma.InputJsonValue,
      hostSupport: structured.hostSupport as Prisma.InputJsonValue,
      generation: {
        source: "CALLER_FACTORY",
        batchId: candidate.batchId,
        promptVersion: CALLER_WORKSHOP_PROMPT_VERSION,
        topicTags: draft.topicTags,
        callMode: draft.callMode,
        emotionalTemperature: draft.emotionalTemperature,
        acceptedAt: new Date().toISOString(),
        automatedVisuals: draft.autoVisuals ? { status: draft.autoVisuals.status, query: draft.autoVisuals.query, count: draft.autoVisuals.items.length, error: draft.autoVisuals.error } : { status: "SKIPPED", count: 0 },
      } as Prisma.InputJsonValue,
      quality: { overall: 0, reviewRequired: true } as Prisma.InputJsonValue,
    } });
    if (draft.autoVisuals?.status === "READY" && draft.autoVisuals.items.length) {
      await tx.callerAsset.createMany({ data: draft.autoVisuals.items.map((image, index) => ({
        callerId: caller.id,
        type: "SUPPORTING_VISUAL",
        label: image.alt.slice(0, 120),
        url: image.imageUrl,
        creditText: `${image.creator} · ${image.provider === "pexels" ? "Pexels" : "Pixabay"}`.slice(0, 160),
        creditUrl: image.sourceUrl,
        manualHotkey: String(index + 1),
        priority: index + 1,
      })) });
    }
    await tx.callerCandidate.update({ where: { id: candidate.id }, data: { status: "ACCEPTED", acceptedCallerId: caller.id, draft: draft as Prisma.InputJsonValue } });
    return caller.id;
  });
}

export async function acceptCallerCandidateAction(batchId: string, candidateId: string) {
  await requireFactory();
  await acceptCandidate(candidateId);
  revalidatePath(`/callers/factory/${batchId}`);
  revalidatePath("/callers");
}

export async function rejectCallerCandidateAction(batchId: string, candidateId: string) {
  await requireFactory();
  const candidate = await prisma.callerCandidate.findUniqueOrThrow({ where: { id: candidateId }, select: { batchId: true, status: true } });
  if (candidate.batchId !== batchId || candidate.status === "ACCEPTED") throw new Error("This candidate cannot be rejected.");
  await prisma.callerCandidate.update({ where: { id: candidateId }, data: { status: "REJECTED" } });
  revalidatePath(`/callers/factory/${batchId}`);
}

export async function restoreCallerCandidateAction(batchId: string, candidateId: string) {
  await requireFactory();
  const candidate = await prisma.callerCandidate.findUniqueOrThrow({ where: { id: candidateId }, select: { batchId: true, status: true } });
  if (candidate.batchId !== batchId || candidate.status !== "REJECTED") return;
  await prisma.callerCandidate.update({ where: { id: candidateId }, data: { status: "PENDING" } });
  revalidatePath(`/callers/factory/${batchId}`);
}

export async function acceptAllCallerCandidatesAction(batchId: string) {
  await requireFactory();
  const candidates = await prisma.callerCandidate.findMany({ where: { batchId, status: "PENDING" }, select: { id: true } });
  for (const candidate of candidates) await acceptCandidate(candidate.id);
  revalidatePath(`/callers/factory/${batchId}`);
  revalidatePath("/callers");
}

export async function setCallerBatchStatusAction(batchId: string, status: "PAUSED" | "CANCELLED" | "RUNNING") {
  await requireFactory();
  await prisma.callerGenerationBatch.update({ where: { id: batchId }, data: { status, error: null } });
  revalidatePath(`/callers/factory/${batchId}`);
}

export async function updateCallerCandidateAction(candidateId: string, formData: FormData) {
  await requireFactory();
  const candidate = await prisma.callerCandidate.findUniqueOrThrow({ where: { id: candidateId }, include: { batch: { include: { show: { include: { moduleSettings: true } } } } } });
  if (candidate.status !== "PENDING") throw new Error("Only pending candidates can be edited.");
  const current = generatedCallerDraftSchema.parse(candidate.draft);
  let draft = generatedCallerDraftSchema.parse({
    ...current,
    firstName: String(formData.get("firstName") ?? "").trim(),
    surnameInitial: String(formData.get("surnameInitial") ?? "").trim().slice(0, 1),
    age: Number(formData.get("age")),
    location: String(formData.get("location") ?? "").trim(),
    occupation: String(formData.get("occupation") ?? "").trim(),
    relationshipStatus: String(formData.get("relationshipStatus") ?? "").trim(),
    issueHeadline: String(formData.get("issueHeadline") ?? "").trim(),
    openingSummary: String(formData.get("openingSummary") ?? "").trim(),
    desiredOutcome: String(formData.get("desiredOutcome") ?? "").trim(),
    speechStyle: String(formData.get("speechStyle") ?? "").trim(),
  });
  if (draft.issueHeadline !== current.issueHeadline && candidate.batch.show) {
    const aiHostSetting = candidate.batch.show.moduleSettings.find((setting) => setting.key === "AI_HOST");
    const automatedVisuals = aiHostSetting?.enabled
      ? readAutomatedVisualConfig(record(aiHostSetting.config), candidate.batch.show.hostMode)
      : { policy: "OFF" as const, avoidPeople: true };
    if (automatedVisuals.policy !== "OFF") draft = { ...draft, autoVisuals: await prepareAutomatedVisuals(draft, automatedVisuals) };
  }
  const key = createHash("sha256").update(draft.issueHeadline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).digest("hex").slice(0, 24);
  await prisma.callerCandidate.update({ where: { id: candidate.id }, data: { draft: draft as Prisma.InputJsonValue, similarityKey: key } });
  revalidatePath(`/callers/factory/${candidate.batchId}`);
  redirect(`/callers/factory/${candidate.batchId}?edited=1`);
}
