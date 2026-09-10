import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getBroadcastSnapshot } from "@/lib/show-service";
import { prisma } from "@/lib/prisma";
import { BroadcastPreview } from "@/components/BroadcastPreview";
import { StudioNav } from "@/components/StudioNav";

export default async function OutputPreviewPage({ params }: { params: Promise<{ showId: string }> }) {
  await requireAdmin();
  const { showId } = await params;
  const [snapshot, show] = await Promise.all([getBroadcastSnapshot(showId), prisma.show.findUniqueOrThrow({ where: { id: showId }, select: { broadcastToken: true } })]);
  return <main className="shell"><StudioNav /><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Output workbench</p><h1 className="title mt-1">Check your canvas</h1><p className="mt-2 text-sm text-slate-400">{snapshot.title} · isolated from the live broadcast</p></div><Link href={`/shows/${showId}`} className="button-secondary">Back to show</Link></div><BroadcastPreview initialSnapshot={snapshot} broadcastUrl={`/broadcast/${showId}?token=${show.broadcastToken}&mode=full&layout=web`} /></main>;
}
