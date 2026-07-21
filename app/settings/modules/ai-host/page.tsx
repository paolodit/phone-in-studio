import Link from "next/link";
import { Bot, Plus } from "lucide-react";
import { HostSoundcheck } from "@/components/HostSoundcheck";
import { StudioNav } from "@/components/StudioNav";
import { saveHostProfileAction } from "@/lib/actions/module-actions";
import { requireAdmin } from "@/lib/auth";
import { moduleEnabled } from "@/lib/modules";
import { prisma } from "@/lib/prisma";

const number = (value: unknown) => typeof value === "number" ? value : 0;
const characteristics = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export default async function AiHostProfilesPage({ searchParams }: { searchParams: Promise<{ profile?: string; saved?: string }> }) {
  await requireAdmin();
  if (!(await moduleEnabled("AI_HOST"))) return <main className="shell"><StudioNav /><div className="panel panel-pad"><p className="eyebrow">AI Host</p><h1 className="title mt-1">Module disabled</h1><p className="mt-3 text-slate-300">Enable AI Host in Optional Modules before creating presenter profiles.</p><Link className="button-primary mt-5" href="/settings/modules">Open module settings</Link></div></main>;
  const query = await searchParams;
  const profiles = await prisma.hostProfile.findMany({ where: { active: true }, orderBy: { updatedAt: "desc" } });
  const selected = profiles.find((profile) => profile.id === query.profile) ?? profiles[0] ?? null;
  const values = characteristics(selected?.characteristics);
  return <main className="shell"><StudioNav />
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Optional module / AI Host</p><h1 className="title mt-1">Presenter profiles</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">A host is reusable across shows. Keep the public setup short; the detailed behaviour remains optional.</p></div><Link href="/settings/modules/ai-host?profile=new" className="button-secondary"><Plus className="h-4 w-4" /> New host</Link></div>
    {profiles.length > 0 && <div className="mt-5 flex gap-2 overflow-x-auto">{profiles.map((profile) => <Link key={profile.id} href={`/settings/modules/ai-host?profile=${profile.id}`} className={`button ${selected?.id === profile.id && query.profile !== "new" ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-200"}`}><Bot className="h-4 w-4" /> {profile.name}</Link>)}</div>}
    {query.saved === "1" && <p className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-300/5 p-3 text-sm text-emerald-100" role="status">Host profile saved. You can soundcheck it below or assign it from a show’s Options.</p>}
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.8fr)]">
      <form className="panel panel-pad" action={saveHostProfileAction.bind(null, query.profile === "new" ? null : selected?.id ?? null)}>
        <p className="eyebrow">{query.profile === "new" || !selected ? "New presenter" : "Presenter setup"}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="label">Presenter name</span><input className="field" name="name" required defaultValue={query.profile === "new" ? "" : selected?.name ?? ""} placeholder="Maya North" /></label><label><span className="label">Public identity</span><input className="field" name="publicIdentity" defaultValue={query.profile === "new" ? "" : selected?.publicIdentity ?? ""} placeholder="Warm late-night presenter" /></label>
          <input type="hidden" name="voiceProvider" value="openai" /><label><span className="label">Voice</span><select className="field" name="voiceId" defaultValue={query.profile === "new" ? "nova" : selected?.voiceId ?? "nova"}><option value="nova">Nova · clear and warm</option><option value="alloy">Alloy · neutral</option><option value="echo">Echo · composed</option><option value="fable">Fable · expressive</option><option value="onyx">Onyx · grounded</option><option value="shimmer">Shimmer · bright</option></select></label>
          <label><span className="label">Hosting style</span><select className="field" name="stylePreset" defaultValue={query.profile === "new" ? "gentle" : selected?.stylePreset ?? "gentle"}><option value="gentle">Gentle late night</option><option value="practical">Practical adviser</option><option value="debate">Robust debate</option><option value="lively">Lively entertainment</option><option value="custom">Custom</option></select></label></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">{[["warmth", "Challenge", "Warmth"], ["energy", "Calm", "Energy"], ["patience", "Brisk", "Patience"], ["playfulness", "Serious", "Playful"]].map(([name, low, high]) => <label key={name}><span className="flex justify-between text-xs font-bold text-slate-300"><span>{low}</span><span>{high}</span></span><input className="mt-2 w-full accent-cyan-400" type="range" min="-2" max="2" step="1" name={name} defaultValue={query.profile === "new" ? 0 : number(values[name])} /></label>)}</div>
        <details className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-3"><summary className="cursor-pointer font-bold text-slate-200">Advanced guidance <span className="ml-2 text-xs font-normal text-slate-500">optional</span></summary><div className="mt-4 grid gap-4"><label><span className="label">How this host runs calls</span><textarea className="field min-h-24" name="guidance" defaultValue={query.profile === "new" ? "" : selected?.guidance ?? ""} placeholder="Ask one concrete question at a time. Let emotional callers finish before challenging assumptions." /></label><label><span className="label">Boundaries and exclusions</span><textarea className="field min-h-20" name="boundaries" defaultValue={query.profile === "new" ? "" : selected?.boundaries ?? ""} placeholder="No diagnosis, legal advice or claims about real private people." /></label></div></details>
        <button className="button-primary mt-5">Save presenter</button>
      </form>
      {selected && query.profile !== "new" ? <HostSoundcheck profileId={selected.id} /> : <section className="panel panel-pad"><p className="eyebrow">Soundcheck</p><p className="mt-3 text-sm leading-6 text-slate-400">Save this presenter first. A private conversational voice test will then appear here.</p></section>}
    </div>
  </main>;
}
