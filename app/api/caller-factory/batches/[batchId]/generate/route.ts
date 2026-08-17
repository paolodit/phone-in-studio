import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { prepareAutomatedVisuals, readAutomatedVisualConfig } from "@/lib/auto-visuals";
import { generateCallerPackChunk } from "@/lib/caller-generation";
import { moduleEnabled } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { generatedCallerDraftSchema } from "@/lib/schemas";

export const runtime = "nodejs";

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const similarityKey = (headline: string) => createHash("sha256").update(headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).digest("hex").slice(0, 24);

export async function POST(_: Request, { params }: { params: Promise<{ batchId: string }> }) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await moduleEnabled("CALLER_FACTORY"))) return NextResponse.json({ error: "Caller Factory is disabled." }, { status: 403 });
  const { batchId } = await params;
  const [batch, libraryCallers] = await Promise.all([
    prisma.callerGenerationBatch.findUniqueOrThrow({ where: { id: batchId }, include: { candidates: { orderBy: { createdAt: "asc" } }, show: { include: { moduleSettings: true } } } }),
    prisma.caller.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { firstName: true, surnameInitial: true, issueHeadline: true } }),
  ]);
  if (["PAUSED", "CANCELLED", "COMPLETED"].includes(batch.status)) return NextResponse.json({ batch });
  const remaining = batch.targetCount - batch.generatedCount;
  if (remaining <= 0) {
    const complete = await prisma.callerGenerationBatch.update({ where: { id: batch.id }, data: { status: "COMPLETED" } });
    return NextResponse.json({ batch: complete });
  }
  const criteria = record(batch.criteria);
  const aiHostSetting = batch.show?.moduleSettings.find((setting) => setting.key === "AI_HOST");
  const automatedVisuals = aiHostSetting?.enabled
    ? readAutomatedVisualConfig(record(aiHostSetting.config), batch.show?.hostMode)
    : { policy: "OFF" as const, avoidPeople: true };
  try {
    await prisma.callerGenerationBatch.update({ where: { id: batch.id }, data: { status: "RUNNING", error: null } });
    const drafts = await generateCallerPackChunk({
      seed: batch.seed,
      tone: String(criteria.tone ?? "varied"),
      mix: String(criteria.mix ?? "balanced"),
      intensity: String(criteria.intensity ?? "medium"),
      exclusions: String(criteria.exclusions ?? "") || undefined,
      count: Math.min(2, remaining),
      existing: [
        ...batch.candidates.map((candidate) => { const draft = generatedCallerDraftSchema.parse(candidate.draft); return { name: `${draft.firstName} ${draft.surnameInitial}`, headline: draft.issueHeadline }; }),
        ...libraryCallers.map((caller) => ({ name: `${caller.firstName}${caller.surnameInitial ? ` ${caller.surnameInitial}` : ""}`, headline: caller.issueHeadline })),
      ],
    });
    // A producer may pause or cancel while the model request is in flight. Re-read
    // the durable batch state before saving so that control takes effect cleanly.
    const latest = await prisma.callerGenerationBatch.findUniqueOrThrow({ where: { id: batch.id }, select: { status: true, generatedCount: true, targetCount: true } });
    if (latest.status === "PAUSED" || latest.status === "CANCELLED") return NextResponse.json({ batch: latest, created: 0 });
    const enrichedDrafts = await Promise.all(drafts.map(async (draft) => ({
      ...draft,
      autoVisuals: await prepareAutomatedVisuals(draft, automatedVisuals),
    })));
    const latestAfterVisuals = await prisma.callerGenerationBatch.findUniqueOrThrow({ where: { id: batch.id }, select: { status: true, generatedCount: true } });
    if (latestAfterVisuals.status === "PAUSED" || latestAfterVisuals.status === "CANCELLED") return NextResponse.json({ batch: latestAfterVisuals, created: 0 });
    const blockedKeys = new Set([
      ...batch.candidates.map((candidate) => candidate.similarityKey),
      ...libraryCallers.map((caller) => similarityKey(caller.issueHeadline)),
    ]);
    const data = enrichedDrafts
      .map((draft) => ({ batchId: batch.id, draft: draft as Prisma.InputJsonValue, similarityKey: similarityKey(draft.issueHeadline) }))
      .filter((draft) => !blockedKeys.has(draft.similarityKey));
    if (data.length === 0) throw new Error("The next pair duplicated callers already in this batch or library. Resume to request a fresher pair.");
    const created = await prisma.callerCandidate.createMany({ data, skipDuplicates: true });
    if (created.count === 0) throw new Error("The next pair duplicated an existing candidate. Resume the batch to ask for a fresh pair.");
    const generatedCount = latestAfterVisuals.generatedCount + created.count;
    const status = generatedCount >= batch.targetCount ? "COMPLETED" : "RUNNING";
    const updated = await prisma.callerGenerationBatch.update({ where: { id: batch.id }, data: { generatedCount, status } });
    return NextResponse.json({ batch: updated, created: created.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Caller generation failed.";
    await prisma.callerGenerationBatch.update({ where: { id: batch.id }, data: { status: "FAILED", error: message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
