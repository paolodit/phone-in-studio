import Link from "next/link";
import { ExternalLink, ListOrdered, Mic2, Settings2 } from "lucide-react";
import { LiveQueueAdder } from "@/components/LiveQueueAdder";
import { QueueOrderEditor } from "@/components/QueueOrderEditor";
import { ShowPreflight } from "@/components/ShowPreflight";
import { StudioNav } from "@/components/StudioNav";
import {
  addSoundEffectAction,
  deleteShowAction,
  deleteSoundEffectAction,
  resetShowForReplayAction,
  updateShowAction,
} from "@/lib/actions/show-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canResetShowForReplay } from "@/lib/show-service";
import { readShowFormatConfig, SHOW_FORMATS } from "@/lib/show-format";

export default async function ShowDetailPage({ params, searchParams }: { params: Promise<{ showId: string }>; searchParams: Promise<{ section?: string }> }) {
  await requireAdmin();
  const { showId } = await params;
  const { section } = await searchParams;
  const [show, approvedCallers] = await Promise.all([
    prisma.show.findUniqueOrThrow({
      where: { id: showId },
      include: {
        queueItems: {
          include: { caller: { include: { assets: true } } },
          orderBy: { position: "asc" },
        },
        soundEffects: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.caller.findMany({
      where: { status: "APPROVED" },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, surnameInitial: true, issueHeadline: true },
    }),
  ]);
  const broadcastUrl = `/broadcast/${show.id}?token=${show.broadcastToken}&mode=full`;
  const hasFinishedCallers = show.queueItems.some((item) => ["COMPLETED", "SKIPPED", "FAILED"].includes(item.status));
  const formatConfig = readShowFormatConfig(show.brandingConfig, show.title);

  return <main className="shell">
    <StudioNav />
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow"><Link href="/shows" className="hover:text-cyan-200">Shows</Link> / {show.status}</p>
        <h1 className="title mt-1">{show.title}</h1>
        <p className="mt-2 text-sm text-slate-400">Broadcast state: {show.broadcastState.replaceAll("_", " ")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/studio?show=${show.id}`} className="button-primary"><Mic2 className="h-4 w-4" /> Open Studio</Link>
        <Link href={broadcastUrl} target="_blank" className="button-secondary"><ExternalLink className="h-4 w-4" /> Broadcast output</Link>
      </div>
    </div>

    <nav className="mt-5 flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-2" aria-label="Show workspace"><Link href={`/studio?show=${show.id}`} className="button-secondary"><Mic2 className="h-4 w-4" /> Studio</Link><Link href={`/shows/${show.id}#running-order`} className="button-primary"><ListOrdered className="h-4 w-4" /> Running order</Link><Link href={`/shows/${show.id}?section=options#show-options`} className="button-secondary"><Settings2 className="h-4 w-4" /> Options</Link></nav>

    <details id="show-options" className="mt-5 scroll-mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-4" open={section === "options"}>
      <summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Show options</p><p className="mt-1 text-sm text-slate-400">Title, format, caller guidance, voice route and show-level actions</p></div><Settings2 className="h-5 w-5 text-slate-500" /></div></summary>
      <form action={updateShowAction.bind(null, show.id)} className="mt-5 grid gap-3 border-t border-slate-700/70 pt-5 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(180px,.7fr)_auto] lg:items-end">
        <label><span className="label">Programme title</span><input className="field" name="title" defaultValue={show.title} required /></label>
        <label><span className="label">Show format</span><select className="field" name="formatId" defaultValue={formatConfig.formatId}>{SHOW_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}</select></label>
        <label><span className="label">Live voice route</span><select className="field" name="voiceProvider" defaultValue={formatConfig.voiceProvider}><option value="openai">OpenAI Realtime</option><option value="elevenlabs">ElevenLabs Agent</option></select></label>
        <button className="button-secondary" type="submit">Save setup</button>
        <label className="lg:col-span-3"><span className="label">Format guidance for AI callers</span><textarea className="field min-h-20" name="formatGuidance" defaultValue={formatConfig.formatGuidance} placeholder="Give callers the tone, host relationship and purpose of this format." /></label>
        <p className="text-xs leading-5 text-slate-400">Use an ElevenLabs Agent only after adding <code>ELEVENLABS_API_KEY</code> and <code>ELEVENLABS_AGENT_ID</code> locally. The API key stays server-side and every live session gets a short-lived browser token.</p>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {canResetShowForReplay(show.broadcastState) && hasFinishedCallers && <form action={resetShowForReplayAction.bind(null, show.id)}><button className="button-secondary">Requeue every caller</button></form>}
        {show.status !== "LIVE" && <form action={deleteShowAction.bind(null, show.id)}><button className="button-danger">Delete show</button></form>}
      </div>
    </details>

    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
      <section id="running-order" className="panel panel-pad scroll-mt-6">
        <div><p className="eyebrow">Live queue</p><h2 className="mt-1 text-lg font-bold text-white">Running order</h2></div>
        <QueueOrderEditor
          showId={show.id}
          items={show.queueItems.map((item) => ({
            id: item.id,
            position: item.position,
            name: `${item.caller.firstName}${item.caller.surnameInitial ? ` ${item.caller.surnameInitial}` : ""}`,
            issue: item.caller.issueHeadline,
            status: item.status,
          }))}
        />
      </section>

      <div className="space-y-6">
        <ShowPreflight show={show} />
        <LiveQueueAdder showId={show.id} showIsLive={show.status === "LIVE"} initialCallers={approvedCallers} />

        <section className="panel panel-pad">
          <p className="eyebrow">Soundboard</p>
          <h2 className="mt-1 text-lg font-bold text-white">Show audio cues</h2>
          <div className="mt-3 space-y-2">
            {show.soundEffects.map((effect) => <div key={effect.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-950 p-2 text-sm">
              <span className="min-w-0 truncate text-slate-200">{effect.label}{effect.loop ? " · loop" : ""}</span>
              <form action={deleteSoundEffectAction.bind(null, show.id, effect.id)}><button className="text-xs font-bold text-red-300">Remove</button></form>
            </div>)}
          </div>
          <form action={addSoundEffectAction.bind(null, show.id)} className="mt-4 grid gap-3">
            <label><span className="label">Cue label</span><input className="field" name="label" placeholder="Incoming call" required /></label>
            <label><span className="label">Audio URL</span><input className="field" name="url" type="url" placeholder="https://…/sting.mp3" required /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Volume</span><input className="field" name="volume" type="number" min="0" max="1" step="0.1" defaultValue="0.8" /></label>
              <label><span className="label">Hotkey label</span><input className="field" name="hotkey" placeholder="F1" /></label>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input name="loop" type="checkbox" /> Loop until stopped</label>
            <button className="button-secondary">Add sound cue</button>
          </form>
        </section>
        <p className="text-xs leading-5 text-slate-400">OBS link uses an unguessable show token. The public route serializes only caller name, location, issue, portrait and actively selected visual.</p>
      </div>
    </div>
  </main>;
}
