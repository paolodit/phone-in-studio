import Link from "next/link";
import { Factory, Layers3 } from "lucide-react";
import { StudioNav } from "@/components/StudioNav";
import { createCallerBatchAction } from "@/lib/actions/caller-factory-actions";
import { requireAdmin } from "@/lib/auth";
import { moduleEnabled } from "@/lib/modules";
import { prisma } from "@/lib/prisma";

export default async function CallerFactoryPage() {
  await requireAdmin();
  if (!(await moduleEnabled("CALLER_FACTORY"))) return <main className="shell"><StudioNav /><div className="panel panel-pad"><p className="eyebrow">Caller Factory</p><h1 className="title mt-1">Module disabled</h1><p className="mt-3 text-slate-300">Enable Caller Factory first. Nothing will be generated or added to your library until then.</p><Link className="button-primary mt-5" href="/settings/modules">Open module settings</Link></div></main>;
  const [batches, shows] = await Promise.all([
    prisma.callerGenerationBatch.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { candidates: true } } } }),
    prisma.show.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, title: true } }),
  ]);
  return <main className="shell"><StudioNav />
    <div><p className="eyebrow">Optional module</p><h1 className="title mt-1">Research & Caller Factory</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Create a deliberately varied pack of 10–20 fictional callers. Generation produces candidates only; your caller library remains untouched until you accept one.</p></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(360px,.75fr)_minmax(0,1.25fr)]">
      <form className="panel panel-pad h-fit" action={createCallerBatchAction}><p className="eyebrow">New candidate pack</p><h2 className="mt-1 text-lg font-bold text-white">Set the editorial range</h2><p className="mt-2 text-xs leading-5 text-slate-400">Describe the overall world of the calls, not each individual character.</p>
        <label className="mt-4 block"><span className="label">Pack name</span><input className="field" name="title" required placeholder="Late-night lives and strange beliefs" /></label>
        <label className="mt-3 block"><span className="label">Broad editorial brief</span><textarea className="field min-h-36" name="seed" required placeholder="Psychologically perceptive late-night callers covering relationships, loneliness, work friction and a smaller number of eccentric beliefs. Keep them humane, specific and varied." /></label>
        <div className="mt-3 grid grid-cols-2 gap-3"><label><span className="label">Pack size</span><select className="field" name="targetCount" defaultValue="10"><option value="10">10 callers</option><option value="12">12 callers</option><option value="15">15 callers</option><option value="20">20 callers</option></select></label><label><span className="label">Attach to show</span><select className="field" name="showId" defaultValue=""><option value="">No particular show</option>{shows.map((show) => <option key={show.id} value={show.id}>{show.title}</option>)}</select></label></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3"><label><span className="label">Tone</span><select className="field" name="tone" defaultValue="varied"><option value="varied">Varied</option><option value="grounded">Grounded</option><option value="reflective">Reflective</option><option value="lively">Lively</option><option value="edgy">Edgy</option><option value="strange">Strange</option></select></label><label><span className="label">Emphasis</span><select className="field" name="mix" defaultValue="balanced"><option value="balanced">Balanced</option><option value="personal">Personal stories</option><option value="advice">Advice</option><option value="opinion">Opinion</option><option value="practical">Practical</option><option value="unusual">Unusual</option></select></label><label><span className="label">Intensity</span><select className="field" name="intensity" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
        <details className="mt-3 rounded-xl border border-slate-700 bg-slate-950/40 p-3"><summary className="cursor-pointer text-sm font-bold text-slate-300">Optional exclusions</summary><textarea className="field min-h-20" name="exclusions" placeholder="Subjects, locations or tones this pack should avoid" /></details>
        <button className="button-primary mt-4 w-full"><Factory className="h-4 w-4" /> Create empty candidate batch</button>
      </form>
      <section><div className="flex items-center justify-between"><div><p className="eyebrow">Candidate inboxes</p><h2 className="mt-1 text-lg font-bold text-white">Saved batches</h2></div><span className="status bg-slate-800 text-slate-300">{batches.length} batches</span></div>
        <div className="mt-3 space-y-3">{batches.map((batch) => <Link key={batch.id} href={`/callers/factory/${batch.id}`} className="panel flex items-center gap-4 p-4 hover:border-cyan-300/50"><Layers3 className="h-6 w-6 shrink-0 text-violet-300" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-white">{batch.title}</h3><span className="status bg-slate-800 text-slate-300">{batch.status}</span></div><p className="mt-1 truncate text-sm text-slate-400">{batch.seed}</p></div><p className="shrink-0 text-sm font-bold text-cyan-200">{batch._count.candidates}/{batch.targetCount}</p></Link>)}{batches.length === 0 && <div className="panel panel-pad text-sm text-slate-400">No batches yet. The first form creates an empty, reviewable workspace before any paid generation begins.</div>}</div>
      </section>
    </div>
  </main>;
}
