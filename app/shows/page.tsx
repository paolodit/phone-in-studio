import Link from "next/link";
import { ExternalLink, ListOrdered, Mic2, Radio, Settings2, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createShowAction } from "@/lib/actions/show-actions";
import { StudioNav } from "@/components/StudioNav";
import { NewShowDialog } from "@/components/NewShowDialog";
import { readShowFormatConfig, SHOW_FORMATS } from "@/lib/show-format";

const voiceRouteLabel = (provider: string) => provider === "gemini" ? "Gemini Live" : provider === "elevenlabs" ? "ElevenLabs" : "OpenAI Realtime 1.5";

export default async function ShowsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const shows = await prisma.show.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { queueItems: true } } } });

  return <main className="shell"><StudioNav />
    <section>
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Show workspaces</p><h1 className="title mt-1">Your phone-ins</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Each show owns its running order, live studio, broadcast output, format and sound cues.</p></div><NewShowDialog action={createShowAction} initialOpen={query.new === "1"} /></div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">{shows.map((show) => {
          const config = readShowFormatConfig(show.brandingConfig, show.title);
          const formatLabel = SHOW_FORMATS.find((format) => format.id === config.formatId)?.label ?? "Custom phone-in";
          return <article key={show.id} className="panel panel-pad">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-bold text-white">{show.title}</h2><span className="status bg-slate-700 text-slate-200">{show.status}</span></div><p className="mt-2 text-sm text-slate-400">{formatLabel} · {voiceRouteLabel(config.voiceProvider)}</p></div><Settings2 className="h-5 w-5 shrink-0 text-slate-600" /></div>
            <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-950/60 p-3"><Users className="h-4 w-4 text-cyan-300" /><p className="mt-2 text-xl font-black text-white">{show._count.queueItems}</p><p className="text-xs text-slate-500">callers in this show</p></div><div className="rounded-xl bg-slate-950/60 p-3"><Radio className="h-4 w-4 text-cyan-300" /><p className="mt-2 text-sm font-bold text-white">{show.broadcastState.replaceAll("_", " ")}</p><p className="text-xs text-slate-500">broadcast state</p></div></div>
            <div className="mt-5 flex flex-wrap gap-2"><Link href={`/studio?show=${show.id}`} className="button-primary"><Mic2 className="h-4 w-4" /> Studio</Link><Link href={`/shows/${show.id}`} className="button-secondary"><ListOrdered className="h-4 w-4" /> Running order & options</Link><Link href={`/broadcast/${show.id}?token=${show.broadcastToken}&mode=full&layout=web`} target="_blank" className="button-secondary" title="Open adaptive broadcast output"><ExternalLink className="h-4 w-4" /><span className="sr-only">Open adaptive broadcast output</span></Link></div>
          </article>;
        })}</div>
        {shows.length === 0 && <div className="panel panel-pad mt-6 text-slate-300">Create your first show workspace, then add approved callers to its running order.</div>}

    </section>
  </main>;
}
