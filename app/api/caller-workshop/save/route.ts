import { CallerStatus, Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/auth";
import { CALLER_WORKSHOP_PROMPT_VERSION, generatedDraftToCallerForm } from "@/lib/caller-generation";
import { callerStructuredData } from "@/lib/caller";
import { prisma } from "@/lib/prisma";
import { generatedCallerSaveSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await requireAdmin();
  try {
    const input = generatedCallerSaveSchema.parse(await request.json());
    const form = generatedDraftToCallerForm(input.draft);
    const structured = callerStructuredData(form);
    const caller = await prisma.caller.create({
      data: {
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
          source: "AI_CALLER_WORKSHOP",
          promptVersion: CALLER_WORKSHOP_PROMPT_VERSION,
          sourceNotes: input.sourceNotes,
          callType: input.callType,
          tone: input.tone,
          selectedPremise: input.premise,
          callMode: input.draft.callMode,
          emotionalTemperature: input.draft.emotionalTemperature,
          emotionalStake: input.draft.emotionalStake,
          topicTags: input.draft.topicTags,
          originalityNotes: input.draft.originalityNotes,
          producerReviewNotes: input.draft.producerReviewNotes,
          generatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        quality: { overall: 0, reviewRequired: true } as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ callerId: caller.id, editUrl: `/callers/${caller.id}` }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "The draft is incomplete." }, { status: 400 });
    console.error("Caller Workshop save failed", error);
    return NextResponse.json({ error: "Unable to save this caller draft." }, { status: 500 });
  }
}
