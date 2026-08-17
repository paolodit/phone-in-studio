"use server";

import { Prisma, type OptionalModuleKey } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hostProfileSchema, optionalModuleKeySchema, showModuleSetupSchema } from "@/lib/schemas";

export async function setOptionalModuleAction(keyValue: string, formData: FormData) {
  await requireAdmin();
  const key = optionalModuleKeySchema.parse(keyValue) as OptionalModuleKey;
  const enabled = formData.get("enabled") === "on";
  await prisma.optionalModuleSetting.upsert({
    where: { key },
    create: { key, enabled, config: {} },
    update: { enabled },
  });
  if (!enabled && key === "AI_HOST") await prisma.show.updateMany({ data: { hostMode: "HUMAN" } });
  revalidatePath("/settings/modules");
  revalidatePath("/shows");
  revalidatePath("/studio");
}

export async function saveHostProfileAction(profileId: string | null, formData: FormData) {
  await requireAdmin();
  const input = hostProfileSchema.parse(Object.fromEntries(formData.entries()));
  const data = {
    name: input.name,
    publicIdentity: input.publicIdentity,
    voiceProvider: input.voiceProvider,
    voiceId: input.voiceId,
    stylePreset: input.stylePreset,
    characteristics: { warmth: input.warmth, energy: input.energy, patience: input.patience, playfulness: input.playfulness } as Prisma.InputJsonValue,
    guidance: input.guidance,
    boundaries: input.boundaries,
  };
  const profile = profileId
    ? await prisma.hostProfile.update({ where: { id: profileId }, data })
    : await prisma.hostProfile.create({ data });
  revalidatePath("/settings/modules/ai-host");
  revalidatePath("/shows");
  redirect(`/settings/modules/ai-host?profile=${profile.id}&saved=1`);
}

export async function updateShowModulesAction(showId: string, formData: FormData) {
  await requireAdmin();
  const input = showModuleSetupSchema.parse(Object.fromEntries(formData.entries()));
  const globalRows = await prisma.optionalModuleSetting.findMany({ where: { enabled: true } });
  const globallyEnabled = new Set(globalRows.map((row) => row.key));
  const aiHostEnabled = globallyEnabled.has("AI_HOST") && input.aiHostEnabled;
  const callerFactoryEnabled = globallyEnabled.has("CALLER_FACTORY") && input.callerFactoryEnabled;
  if (aiHostEnabled && input.hostMode !== "HUMAN" && !input.hostProfileId) throw new Error("Choose an AI host profile before enabling an AI host mode.");
  const hostConfig = {
    maxTurnsPerCaller: input.autoMaxTurns,
    betweenCallsSeconds: input.autoBetweenCallsSeconds,
    visualPolicy: input.autoVisualPolicy,
    visualAvoidPeople: input.autoVisualAvoidPeople,
  } as Prisma.InputJsonValue;
  await prisma.$transaction([
    prisma.showModuleSetting.upsert({ where: { showId_key: { showId, key: "AI_HOST" } }, create: { showId, key: "AI_HOST", enabled: aiHostEnabled, config: hostConfig }, update: { enabled: aiHostEnabled, config: hostConfig } }),
    prisma.showModuleSetting.upsert({ where: { showId_key: { showId, key: "CALLER_FACTORY" } }, create: { showId, key: "CALLER_FACTORY", enabled: callerFactoryEnabled, config: {} }, update: { enabled: callerFactoryEnabled } }),
    prisma.show.update({ where: { id: showId }, data: { hostMode: aiHostEnabled ? input.hostMode : "HUMAN", hostProfileId: aiHostEnabled ? input.hostProfileId : null } }),
  ]);
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/studio");
}
