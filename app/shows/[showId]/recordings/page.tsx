import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StudioNav } from "@/components/StudioNav";
import { RecordingLibrary } from "@/components/RecordingLibrary";

export default async function RecordingsPage({ params }: { params: Promise<{ showId: string }> }) {
  await requireAdmin(); const { showId } = await params;
  const show = await prisma.show.findUniqueOrThrow({ where: { id: showId }, select: { title: true } });
  return <main className="shell"><StudioNav /><header className="mb-6 flex flex-wrap justify-between gap-4"><div><p className="eyebrow">Recordings & moments</p><h1 className="title mt-1">{show.title}</h1></div><div className="flex flex-wrap gap-2"><Link href={`/shows/${showId}`} className="button-secondary">Prepare show</Link><Link href={`/studio?show=${showId}`} className="button-primary">Back to Studio</Link></div></header><RecordingLibrary showId={showId} /></main>;
}
