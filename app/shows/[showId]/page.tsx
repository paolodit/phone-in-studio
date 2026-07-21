import Link from "next/link";
import { Bot, ExternalLink, Factory, ListOrdered, Mic2, Monitor, Settings2, Smartphone } from "lucide-react";
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
import { updateShowModulesAction } from "@/lib/actions/module-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canResetShowForReplay } from "@/lib/show-service";
import { readShowFormatConfig, SHOW_FORMATS } from "@/lib/show-format";
import { globalModuleState } from "@/lib/modules";

const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export default async function ShowDetailPage({ params, searchParams }: { params: Promise<{ showId: string }>; searchParams: Promise<{ section?: string }> }) {
  await requireAdmin();
  const { showId } = await params;
  const { section } = await searchParams;
  const moduleState = await globalModuleState();
  const [show, approvedCallers, hostProfiles] = await Promise.all([
    prisma.show.findUniqueOrThrow({
      where: { id: showId },
      include: {
        queueItems: {
          include: { caller: { include: { assets: true } } },
          orderBy: { position: "asc" },
        },
        soundEffects: { orderBy: { createdAt: "asc" } },
        moduleSettings: true,
      },
    }),
    prisma.caller.findMany({
      where: { status: "APPROVED" },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, surnameInitial: true, issueHeadline: true },
    }),
    moduleState.AI_HOST ? prisma.hostProfile.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const broadcastUrl = `/broadcast/${show.id}?token=${show.broadcastToken}&mode=full&layout=web`;
  const hasFinishedCallers = show.queueItems.some((item) => ["COMPLETED", "SKIPPED", "FAILED"].includes(item.status));
  const formatConfig = readShowFormatConfig(show.brandingConfig, show.title);
  const aiHostSetting = show.moduleSettings.find((item) => item.key === "AI_HOST");
  const aiHostConfig = object(aiHostSetting?.config);

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
        <label><span className="label">Live voice route</span><select className="field" name="voiceProvider" defaultValue={formatConfig.voiceProvider}><option value="openai">OpenAI Realtime 1.5 (default)</option><option value="gemini">Gemini Live (optional)</option><option value="elevenlabs">ElevenLabs Agent (optional)</option></select></label>
        <button className="button-secondary" type="submit">Save setup</button>
        <label className="lg:col-span-3"><span className="label">Format guidance for AI callers</span><textarea className="field min-h-20" name="formatGuidance" defaultValue={formatConfig.formatGuidance} placeholder="Give callers the tone, host relationship and purpose of this format." /></label>
        <p className="text-xs leading-5 text-slate-400">Gemini Live needs <code>GEMINI_API_KEY</code>. ElevenLabs needs <code>ELEVENLABS_API_KEY</code> and <code>ELEVENLABS_AGENT_ID</code>. Permanent keys stay server-side; each browser connection uses a short-lived credential.</p>
      </form>
      {(moduleState.AI_HOST || moduleState.CALLER_FACTORY) && <section className="mt-5 border-t border-slate-700/70 pt-5">
        <div><p className="eyebrow">Optional modules</p><p className="mt-1 text-sm text-slate-400">Global switches only make modules available. This show still opts in separately.</p></div>
        <form action={updateShowModulesAction.bind(null, show.id)} className="mt-4 grid gap-4 lg:grid-cols-2">
          {moduleState.AI_HOST && <div className="rounded-xl border border-violet-300/20 bg-violet-300/5 p-4">
            <div className="flex items-start gap-3"><Bot className="mt-0.5 h-5 w-5 text-violet-200" /><div><p className="font-bold text-white">AI Host</p><p className="mt-1 text-xs leading-5 text-slate-400">Choose one-turn supervision or a deliberately armed automatic running mode. Human takeover remains immediate.</p></div></div>
            <label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-200"><input type="checkbox" name="aiHostEnabled" defaultChecked={Boolean(aiHostSetting?.enabled)} /> Enable for this show</label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label><span className="label">Presenter</span><select className="field" name="hostProfileId" defaultValue={show.hostProfileId ?? ""}><option value="">Choose a profile</option>{hostProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
              <label><span className="label">Host mode</span><select className="field" name="hostMode" defaultValue={show.hostMode}><option value="HUMAN">Human host</option><option value="AI_SUPERVISED">AI host · supervised</option><option value="AI_AUTONOMOUS">AI host · auto-run</option></select></label>
              <label><span className="label">Conversation turns</span><input className="field" type="number" name="autoMaxTurns" min="1" max="8" defaultValue={Number(aiHostConfig.maxTurnsPerCaller ?? 4)} /></label>
              <label><span className="label">Seconds between calls</span><input className="field" type="number" name="autoBetweenCallsSeconds" min="1" max="15" defaultValue={Number(aiHostConfig.betweenCallsSeconds ?? 3)} /></label>
              <label><span className="label">Automated topic visuals</span><select className="field" name="autoVisualPolicy" defaultValue={String(aiHostConfig.visualPolicy ?? (show.hostMode === "AI_AUTONOMOUS" ? "AUTO_SHOW" : "OFF"))}><option value="OFF">Off · portraits only</option><option value="PREPARE">Prepare · host triggers</option><option value="AUTO_SHOW">Full auto · prepare and show</option></select></label>
              <label className="flex items-center gap-2 self-end rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm font-bold text-slate-200"><input type="checkbox" name="autoVisualAvoidPeople" defaultChecked={aiHostConfig.visualAvoidPeople !== false} /> Prefer objects and places, not people</label>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs"><Link className="font-bold text-violet-200 hover:text-white" href="/settings/modules/ai-host">Manage profiles</Link><span className="text-slate-500">Full auto prepares credited stock images before broadcast, shows one after the caller opens and falls back to the portrait if none is available.</span></div>
          </div>}
          {moduleState.CALLER_FACTORY && <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4"><div className="flex items-start gap-3"><Factory className="mt-0.5 h-5 w-5 text-cyan-200" /><div><p className="font-bold text-white">Caller Factory</p><p className="mt-1 text-xs leading-5 text-slate-400">Allows a candidate batch to be developed with this show as its editorial home.</p></div></div><label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-200"><input type="checkbox" name="callerFactoryEnabled" defaultChecked={Boolean(show.moduleSettings.find((item) => item.key === "CALLER_FACTORY")?.enabled)} /> Enable for this show</label><Link className="button-secondary mt-3" href="/callers/factory"><Factory className="h-4 w-4" /> Open Caller Factory</Link></div>}
          {!moduleState.AI_HOST && <input type="hidden" name="hostMode" value="HUMAN" />}
          <div className="lg:col-span-2"><button className="button-primary">Save module setup</button></div>
        </form>
      </section>}
      <div className="mt-3 flex flex-wrap gap-2">
        {canResetShowForReplay(show.broadcastState) && hasFinishedCallers && <form action={resetShowForReplayAction.bind(null, show.id)}><button className="button-secondary">Requeue every caller</button></form>}
        {show.status !== "LIVE" && <form action={deleteShowAction.bind(null, show.id)}><button className="button-danger">Delete show</button></form>}
      </div>
    </details>

    <section className="panel panel-pad mt-6">
      <div><p className="eyebrow">Output layouts</p><h2 className="mt-1 text-lg font-bold text-white">Choose the canvas, then size the browser source</h2><p className="mt-2 text-sm text-slate-400">These are presentation panes, not complete stream scenes. Place them alongside your host camera, chat or other sources in OBS, TikTok Live Studio or your web layout.</p></div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Link href={broadcastUrl} target="_blank" className="rounded-xl border border-slate-700 bg-slate-950/50 p-4 hover:border-cyan-400/50"><Monitor className="h-5 w-5 text-cyan-300" /><p className="mt-3 font-bold text-white">Web · adaptive</p><p className="mt-1 text-xs leading-5 text-slate-400">Automatically switches between narrow and wide composition as its pane changes.</p></Link>
        <Link href={`/broadcast/${show.id}?token=${show.broadcastToken}&mode=full&layout=tiktok`} target="_blank" className="rounded-xl border border-slate-700 bg-slate-950/50 p-4 hover:border-cyan-400/50"><Smartphone className="h-5 w-5 text-cyan-300" /><p className="mt-3 font-bold text-white">TikTok · 9:16</p><p className="mt-1 text-xs leading-5 text-slate-400">Vertical hierarchy with safe, compact caller information for a portrait pane.</p></Link>
        <Link href={`/broadcast/${show.id}?token=${show.broadcastToken}&mode=full&layout=twitch`} target="_blank" className="rounded-xl border border-slate-700 bg-slate-950/50 p-4 hover:border-cyan-400/50"><Monitor className="h-5 w-5 text-violet-300" /><p className="mt-3 font-bold text-white">Twitch / OBS · 16:9</p><p className="mt-1 text-xs leading-5 text-slate-400">Widescreen caller card that leaves the surrounding stream scene to your broadcast tool.</p></Link>
      </div>
    </section>

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
