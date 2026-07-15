import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CallerTestStudio, type CallerTestProfile } from "@/components/CallerTestStudio";
import { StudioNav } from "@/components/StudioNav";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export default async function CallerTestPage({ params }: { params: Promise<{ callerId: string }> }) {
  await requireAdmin();
  const { callerId } = await params;
  const caller = await prisma.caller.findUniqueOrThrow({ where: { id: callerId }, include: { assets: true } });
  const performance = record(caller.performance);
  const portrait = caller.assets.find((asset) => asset.type === "PORTRAIT");
  const profile: CallerTestProfile = {
    id: caller.id,
    name: `${caller.firstName}${caller.surnameInitial ? ` ${caller.surnameInitial}` : ""}`,
    age: caller.age ?? undefined,
    location: caller.location,
    occupation: caller.occupation ?? undefined,
    issueHeadline: caller.issueHeadline,
    openingSummary: caller.openingSummary,
    portraitUrl: portrait?.url,
    voiceId: typeof performance.voiceId === "string" ? performance.voiceId : "marin",
  };

  return <main className="shell"><StudioNav /><div className="mb-5"><Link href={`/callers/${caller.id}`} className="button-secondary"><ArrowLeft className="h-4 w-4" /> Back to caller</Link></div><CallerTestStudio caller={profile} /></main>;
}
