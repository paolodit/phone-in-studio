import { z } from "zod";
import { generatedCallerDraftSchema } from "@/lib/schemas";

export const showBriefSchema = z.object({
  brief: z.string().trim().min(15, "Give the show a little more detail (at least 15 characters).").max(3000),
  durationMinutes: z.number().int().min(10).max(90),
  count: z.union([z.literal(4), z.literal(6)]).default(4),
});
export const planSlotSchema = z.object({
  id: z.string().uuid(), keep: z.boolean(), minutes: z.number().int().min(1).max(30),
  role: z.string().trim().min(2).max(80),
  reasonTonight: z.string().trim().min(5).max(400),
  visualIdea: z.string().trim().min(2).max(200),
  draft: generatedCallerDraftSchema,
});
export const planContentSchema = z.object({
  title: z.string().trim().min(3).max(120),
  synopsis: z.string().trim().min(5).max(700),
  slots: z.array(planSlotSchema).min(1).max(6).refine((slots) => new Set(slots.map((slot) => slot.id)).size === slots.length, "Duplicate caller cards."),
});
export type PlanContent = z.infer<typeof planContentSchema>;
export type ShowPlanView = { id: string; brief: string; durationMinutes: number; content: PlanContent; revision: number; acceptedShowId: string | null };

export function planTiming(content: PlanContent, duration: number) {
  const selected = content.slots.filter((slot) => slot.keep);
  const callerMinutes = selected.reduce((sum, slot) => sum + slot.minutes, 0);
  return { count: selected.length, callerMinutes, remainingMinutes: duration - callerMinutes };
}

export function allocateCallMinutes(duration: number, count: number) {
  const available = Math.max(count, duration - 2);
  return Array.from({ length: count }, (_, index) => Math.floor(available / count) + (index < available % count ? 1 : 0));
}
