"use server";

import { CallerStatus, Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { callerStructuredData } from "@/lib/caller";
import { jsonRecord, parseCallerTags } from "@/lib/caller-tags";
import { searchStockImages } from "@/lib/stock-images";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callerAssetFormSchema, callerFormSchema, callerReviewSchema } from "@/lib/schemas";

function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createCallerAction(formData: FormData) {
  await requireAdmin();
  const input = callerFormSchema.parse(formToObject(formData));
  const structured = callerStructuredData(input);
  const caller = await prisma.caller.create({
    data: {
      firstName: input.firstName,
      surnameInitial: input.surnameInitial,
      age: input.age,
      location: input.location,
      occupation: input.occupation,
      relationshipStatus: input.relationshipStatus,
      issueHeadline: input.issueHeadline,
      openingSummary: input.openingSummary,
      character: structured.character as Prisma.InputJsonValue,
      story: structured.story as Prisma.InputJsonValue,
      performance: structured.performance as Prisma.InputJsonValue,
      hostSupport: structured.hostSupport as Prisma.InputJsonValue,
      generation: { topicTags: parseCallerTags(input.topicTags) } as Prisma.InputJsonValue,
      quality: { overall: 0 } as Prisma.InputJsonValue,
      ...(input.portraitUrl
        ? { assets: { create: { type: "PORTRAIT", label: `${input.firstName} portrait`, url: input.portraitUrl } } }
        : {}),
    },
  });
  redirect(`/callers/${caller.id}`);
}

export async function updateCallerAction(callerId: string, formData: FormData) {
  await requireAdmin();
  const input = callerFormSchema.parse(formToObject(formData));
  const structured = callerStructuredData(input);
  const existingCaller = await prisma.caller.findUniqueOrThrow({ where: { id: callerId }, select: { generation: true } });
  await prisma.$transaction(async (tx) => {
    await tx.caller.update({
      where: { id: callerId },
      data: {
        firstName: input.firstName,
        surnameInitial: input.surnameInitial,
        age: input.age,
        location: input.location,
        occupation: input.occupation,
        relationshipStatus: input.relationshipStatus,
        issueHeadline: input.issueHeadline,
        openingSummary: input.openingSummary,
        character: structured.character as Prisma.InputJsonValue,
        story: structured.story as Prisma.InputJsonValue,
        performance: structured.performance as Prisma.InputJsonValue,
        hostSupport: structured.hostSupport as Prisma.InputJsonValue,
        generation: { ...jsonRecord(existingCaller.generation), topicTags: parseCallerTags(input.topicTags) } as Prisma.InputJsonValue,
      },
    });
    if (input.portraitUrl) {
      const existing = await tx.callerAsset.findFirst({ where: { callerId, type: "PORTRAIT" } });
      if (existing) await tx.callerAsset.update({ where: { id: existing.id }, data: { url: input.portraitUrl } });
      else await tx.callerAsset.create({ data: { callerId, type: "PORTRAIT", label: `${input.firstName} portrait`, url: input.portraitUrl } });
    }
  });
  revalidatePath(`/callers/${callerId}`);
  revalidatePath("/callers");
}

export async function approveCallerAction(callerId: string) {
  await requireAdmin();
  await prisma.caller.update({
    where: { id: callerId },
    data: { status: CallerStatus.APPROVED, approvedAt: new Date(), approvedBy: "admin" },
  });
  revalidatePath(`/callers/${callerId}`);
  revalidatePath("/callers");
}

export async function saveCallerReviewAction(callerId: string, formData: FormData) {
  await requireAdmin();
  const review = callerReviewSchema.parse(formToObject(formData));
  const caller = await prisma.caller.findUniqueOrThrow({ where: { id: callerId }, select: { quality: true } });
  const existingQuality = caller.quality && typeof caller.quality === "object" && !Array.isArray(caller.quality) ? caller.quality as Record<string, unknown> : {};
  const checklist = {
    fictionalRightsChecked: review.fictionalRightsChecked,
    toneChecked: review.toneChecked,
    hostRouteChecked: review.hostRouteChecked,
    technicalChecked: review.technicalChecked,
  };
  const completed = Object.values(checklist).filter(Boolean).length;
  await prisma.caller.update({
    where: { id: callerId },
    data: {
      producerNotes: review.producerNotes,
      quality: {
        ...existingQuality,
        overall: Math.round((completed / 4) * 100),
        approvalChecklist: checklist,
        reviewedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });
  revalidatePath(`/callers/${callerId}`);
  revalidatePath("/callers");
}

export async function beginCallerRehearsalAction(callerId: string) {
  await requireAdmin();
  const caller = await prisma.caller.findUniqueOrThrow({ where: { id: callerId }, select: { status: true } });
  await prisma.caller.update({
    where: { id: callerId },
    data: {
      rehearsalCount: { increment: 1 },
      ...(caller.status === CallerStatus.DRAFT || caller.status === CallerStatus.DEVELOPING ? { status: CallerStatus.REHEARSING } : {}),
    },
  });
  revalidatePath(`/callers/${callerId}`);
  revalidatePath("/callers");
}

export async function deleteCallerAction(callerId: string) {
  await requireAdmin();
  const queuedCount = await prisma.queueItem.count({ where: { callerId } });
  if (queuedCount > 0) throw new Error("A caller with show history cannot be deleted. Mark it skipped or retain it for the audit trail.");
  await prisma.caller.delete({ where: { id: callerId } });
  revalidatePath("/callers");
  redirect("/callers");
}

export async function addSupportingVisualAction(callerId: string, formData: FormData) {
  await requireAdmin();
  const input = callerAssetFormSchema.parse(formToObject(formData));
  await prisma.callerAsset.create({
    data: { callerId, type: "SUPPORTING_VISUAL", label: input.label, url: input.url, manualHotkey: input.manualHotkey },
  });
  revalidatePath(`/callers/${callerId}`);
}

export async function prepareTopicVisualsAction(callerId: string) {
  await requireAdmin();
  const caller = await prisma.caller.findUniqueOrThrow({ where: { id: callerId }, select: { issueHeadline: true, openingSummary: true } });
  const query = `${caller.issueHeadline} ${caller.openingSummary}`.slice(0, 180);
  const { results } = await searchStockImages(query, "auto");
  if (!results.length) throw new Error("No suitable stock images were found. Try the image feed with a broader search.");
  const start = Math.floor(Date.now() / 1_000) % results.length;
  const selected = Array.from({ length: Math.min(3, results.length) }, (_, index) => results[(start + index) % results.length]);
  await prisma.$transaction(async (tx) => {
    await tx.callerAsset.deleteMany({ where: { callerId, type: "SUPPORTING_VISUAL", url: { endsWith: "/visuals/placeholder.svg" } } });
    await tx.callerAsset.createMany({ data: selected.map((image, index) => ({
      callerId,
      type: "SUPPORTING_VISUAL",
      label: `${image.provider === "pexels" ? "Pexels" : "Pixabay"}: ${image.alt}`.slice(0, 120),
      url: image.imageUrl,
      manualHotkey: String(index + 1),
      priority: index + 1,
    })) });
  });
  revalidatePath(`/callers/${callerId}`);
  revalidatePath("/studio");
}

export async function deleteCallerAssetAction(callerId: string, assetId: string) {
  await requireAdmin();
  const asset = await prisma.callerAsset.findUniqueOrThrow({ where: { id: assetId }, select: { callerId: true } });
  if (asset.callerId !== callerId) throw new Error("Asset does not belong to this caller.");
  await prisma.callerAsset.delete({ where: { id: assetId } });
  revalidatePath(`/callers/${callerId}`);
}
