import Link from "next/link";
import { Bot, Factory, SlidersHorizontal } from "lucide-react";
import { StudioNav } from "@/components/StudioNav";
import { setOptionalModuleAction } from "@/lib/actions/module-actions";
import { requireAdmin } from "@/lib/auth";
import { globalModuleState, OPTIONAL_MODULES } from "@/lib/modules";

export default async function OptionalModulesPage() {
  await requireAdmin();
  const state = await globalModuleState();
  return <main className="shell"><StudioNav />
    <div><p className="eyebrow">Settings</p><h1 className="title mt-1">Optional modules</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">The normal human-host phone-in stays exactly as it is. Enable a capability here before it appears in show options or caller management.</p></div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="panel panel-pad"><div className="flex items-start gap-3"><Bot className="mt-1 h-6 w-6 text-cyan-300" /><div><p className="eyebrow">AI Host</p><h2 className="mt-1 text-xl font-bold text-white">A configurable supervised presenter</h2><p className="mt-2 text-sm leading-6 text-slate-400">Create reusable host profiles, test their voice privately and assign one to an individual show. The producer retains queue and emergency controls.</p></div></div>
        <form className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950/60 p-3" action={setOptionalModuleAction.bind(null, "AI_HOST")}><label className="flex items-center gap-3 text-sm font-bold text-slate-200"><input type="checkbox" name="enabled" defaultChecked={state.AI_HOST} /> Make AI Host available</label><button className="button-primary">Save</button></form>
        {state.AI_HOST && <Link className="button-secondary mt-3" href="/settings/modules/ai-host"><SlidersHorizontal className="h-4 w-4" /> Manage host profiles</Link>}
      </section>
      <section className="panel panel-pad"><div className="flex items-start gap-3"><Factory className="mt-1 h-6 w-6 text-violet-300" /><div><p className="eyebrow">Caller Factory</p><h2 className="mt-1 text-xl font-bold text-white">Staged caller packs, not library clutter</h2><p className="mt-2 text-sm leading-6 text-slate-400">Generate 10–20 fictional candidates from a broad editorial brief. Candidates stay in a review inbox until you explicitly accept them.</p></div></div>
        <form className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950/60 p-3" action={setOptionalModuleAction.bind(null, "CALLER_FACTORY")}><label className="flex items-center gap-3 text-sm font-bold text-slate-200"><input type="checkbox" name="enabled" defaultChecked={state.CALLER_FACTORY} /> Make Caller Factory available</label><button className="button-primary">Save</button></form>
        {state.CALLER_FACTORY && <Link className="button-secondary mt-3" href="/callers/factory"><Factory className="h-4 w-4" /> Open candidate batches</Link>}
      </section>
    </div>
    <section className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-slate-300"><b className="text-amber-100">Cost and control:</b> enabling a module does not start generation or a host. Every show opts in separately, and every Factory batch has a fixed 10–20 caller target.</section>
  </main>;
}
