import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBroadcastSnapshot } from "@/lib/show-service";
import { getStudioState } from "@/lib/studio-state";
import { StudioNav } from "@/components/StudioNav";
import { StudioClient } from "@/components/StudioClient";
import { readShowFormatConfig } from "@/lib/show-format";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  const { show: requestedShow } = await searchParams;
  const shows = await prisma.show.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, title: true, status: true } });
  const showId = requestedShow && shows.some((show) => show.id === requestedShow) ? requestedShow : shows[0]?.id;
  if (!showId) return <main className="shell"><StudioNav /><div className="panel panel-pad"><p className="eyebrow">Host Studio</p><h1 className="title mt-1">No show is ready</h1><p className="mt-3 text-slate-300">Create a show and queue manually approved callers to start a mock run-through.</p><Link href="/shows" className="button-primary mt-5">Create a show</Link></div></main>;

  const [show, snapshot, studioState] = await Promise.all([
    prisma.show.findUniqueOrThrow({ where: { id: showId }, select: { id: true, title: true, broadcastToken: true, brandingConfig: true } }),
    getBroadcastSnapshot(showId),
    getStudioState(showId),
  ]);

  const formatConfig = readShowFormatConfig(show.brandingConfig, show.title);
  return <main className="shell"><StudioNav /><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Host Studio · {formatConfig.formatLabel}</p><h1 className="title mt-1">{show.title}</h1></div><div className="flex flex-wrap gap-2"><Link className="button-secondary" href={`/shows/${show.id}`}>Prepare show</Link><Link className="button-secondary" href={`/callers?show=${show.id}`}>+ Add callers</Link><Link className="button-secondary" href={`/broadcast/${show.id}?token=${show.broadcastToken}&mode=full`} target="_blank">Preview broadcast</Link></div></div><StudioClient showId={show.id} initialSnapshot={snapshot} initialStudioState={studioState} initialVoiceProvider={formatConfig.voiceProvider} /></main>;
}
