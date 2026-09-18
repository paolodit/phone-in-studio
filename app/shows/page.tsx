import Link from "next/link";
import { ExternalLink, ListOrdered, Mic2, Radio, Settings2, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createShowAction, deleteShowAction } from "@/lib/actions/show-actions";
import { StudioNav } from "@/components/StudioNav";
import { ChannelCreationDialog } from "@/components/ChannelCreationDialog";
import { DeleteChannelDialog } from "@/components/DeleteChannelDialog";
import { starterPackMenu } from "@/lib/starter-packs";
import { readShowFormatConfig, SHOW_FORMATS } from "@/lib/show-format";

const voiceRouteLabel = (provider: string) => provider === "openai-live" ? "GPT-Live-1" : provider === "gemini" ? "Gemini Live" : provider === "elevenlabs" ? "ElevenLabs" : provider === "fish" ? "Fish Audio S2.1" : "OpenAI Realtime 1.5";

export default async function ShowsPage({ searchParams }: { searchParams: Promise<{ new?: string; deleted?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const shows = await prisma.show.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { queueItems: true } } } });

  return <main className="shell"><StudioNav />
    <section>
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Channels · show workspaces</p><h1 className="title mt-1">Your phone-ins</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Each channel owns its running order, live studio, broadcast output, format and sound cues.</p></div><ChannelCreationDialog key={`${query.new ?? "closed"}:${shows.length === 0}`} action={createShowAction} packs={starterPackMenu} firstChannel={shows.length === 0} initialOpen={query.new === "1" || shows.length === 0} /></div>
        {query.deleted && <p role="status" className="mt-5 rounded-xl border border-slate-700 p-4 text-sm text-slate-300">Channel deleted. Your caller library and other channels are unchanged. <Link className="text-cyan-200 underline" href={`/shows/${encodeURIComponent(query.deleted)}/recordings`}>Open retained local recordings</Link></p>}

        <Link href="/shows/plan" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-cyan-950/50 to-slate-900 p-6 hover:border-cyan-300/60"><div><p className="eyebrow">Have a spark?</p><h2 className="mt-2 text-xl font-bold text-white">Make tonight’s show</h2><p className="mt-2 text-sm text-slate-300">One brief. A varied line-up. Yours to shape before it goes on air.</p></div><span className="button-primary">Plan a show →</span></Link>
        <div className="mt-6 grid gap-4 xl:grid-cols-2">{shows.map((show) => {
          const config = readShowFormatConfig(show.brandingConfig, show.title);
          const formatLabel = SHOW_FORMATS.find((format) => format.id === config.formatId)?.label ?? "Custom phone-in";
          return <article key={show.id} className="panel panel-pad">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-bold text-white">{show.title}</h2><span className="status bg-slate-700 text-slate-200">{show.status}</span></div><p className="mt-2 text-sm text-slate-400">{formatLabel} · {voiceRouteLabel(config.voiceProvider)}</p></div><Settings2 className="h-5 w-5 shrink-0 text-slate-600" /></div>
            <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-950/60 p-3"><Users className="h-4 w-4 text-cyan-300" /><p className="mt-2 text-xl font-black text-white">{show._count.queueItems}</p><p className="text-xs text-slate-500">callers in this show</p></div><div className="rounded-xl bg-slate-950/60 p-3"><Radio className="h-4 w-4 text-cyan-300" /><p className="mt-2 text-sm font-bold text-white">{show.broadcastState.replaceAll("_", " ")}</p><p className="text-xs text-slate-500">broadcast state</p></div></div>
            <div className="mt-5 flex flex-wrap gap-2"><Link href={`/studio?show=${show.id}`} className="button-primary"><Mic2 className="h-4 w-4" /> Studio</Link><Link href={`/shows/${show.id}`} className="button-secondary"><ListOrdered className="h-4 w-4" /> Running order & options</Link><Link href={`/broadcast/${show.id}?token=${show.broadcastToken}&mode=full&layout=web`} target="_blank" className="button-secondary" title="Open adaptive broadcast output"><ExternalLink className="h-4 w-4" /><span className="sr-only">Open adaptive broadcast output</span></Link></div>
            <div className="mt-4 border-t border-slate-800 pt-4"><DeleteChannelDialog id={show.id} title={show.title} live={show.status === "LIVE"} action={deleteShowAction.bind(null, show.id)} /></div>
          </article>;
        })}</div>
        {shows.length === 0 && <div className="panel panel-pad mt-6 text-slate-300">No channels yet. Choose New channel to start with a pack or build your own.</div>}

    </section>
  </main>;
}
