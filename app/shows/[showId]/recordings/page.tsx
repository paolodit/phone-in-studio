import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StudioNav } from "@/components/StudioNav";
import { RecordingLibrary } from "@/components/RecordingLibrary";

export default async function RecordingsPage({ params }: { params: Promise<{ showId: string }> }) {
  await requireAdmin(); const { showId } = await params;
  const show = await prisma.show.findUnique({ where: { id: showId }, select: { title: true } });
  return <main className="shell"><StudioNav /><header className="mb-6 flex flex-wrap justify-between gap-4"><div><p className="eyebrow">Recordings & moments</p><h1 className="title mt-1">{show?.title ?? "Deleted channel recordings"}</h1>{!show && <p className="mt-2 text-sm text-slate-400">The channel is gone. Recordings saved in this browser remain available to download or delete here. Bookmark this page to return.</p>}</div><div className="flex flex-wrap gap-2">{show ? <><Link href={`/shows/${showId}`} className="button-secondary">Prepare show</Link><Link href={`/studio?show=${showId}`} className="button-primary">Back to Studio</Link></> : <Link href="/shows" className="button-secondary">Channels</Link>}</div></header><RecordingLibrary showId={showId} /></main>;
}
