import { beginCallerRehearsalAction, saveCallerReviewAction } from "@/lib/actions/caller-actions";

type ReviewCaller = {
  id: string;
  status: string;
  rehearsalCount: number;
  producerNotes: string | null;
  quality: unknown;
  generation: unknown;
};

const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const checked = (value: Record<string, unknown>, key: string) => value[key] === true;
const stringList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function CallerReviewPanel({ caller }: { caller: ReviewCaller }) {
  const quality = object(caller.quality);
  const checklist = object(quality.approvalChecklist);
  const generation = object(caller.generation);
  const workshopNotes = stringList(generation.producerReviewNotes);
  const checkedCount = ["fictionalRightsChecked", "toneChecked", "hostRouteChecked", "technicalChecked"].filter((key) => checked(checklist, key)).length;
  return <section className="panel panel-pad">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Producer review</p><h2 className="mt-1 text-lg font-bold text-white">Rehearsal and approval readiness</h2><p className="mt-2 max-w-2xl text-sm text-slate-400">The caller is usable as a draft immediately. Open the checklist when you need to record formal sign-off; it never auto-approves a caller.</p></div><div className="rounded-lg bg-slate-950 px-3 py-2 text-right"><p className="text-lg font-black text-cyan-300">{checkedCount}/4</p><p className="text-[11px] uppercase tracking-wide text-slate-500">checks complete</p></div></div>
    <details className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4"><summary className="cursor-pointer font-bold text-slate-100">Open review checklist and notes</summary>{workshopNotes.length > 0 && <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-950/30 p-4"><p className="text-sm font-bold text-amber-100">Workshop review notes</p><ul className="mt-2 space-y-1 text-sm text-amber-50/90">{workshopNotes.map((note) => <li key={note}>• {note}</li>)}</ul></div>}
      <form action={saveCallerReviewAction.bind(null, caller.id)} className="mt-4 space-y-4"><fieldset><legend className="label">Producer checklist</legend><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200"><input className="mt-0.5" type="checkbox" name="fictionalRightsChecked" defaultChecked={checked(checklist, "fictionalRightsChecked")} /><span><strong className="block text-white">Fictional and rights-checked</strong>No real people, private details, brands or recognisable borrowed characters.</span></label><label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200"><input className="mt-0.5" type="checkbox" name="toneChecked" defaultChecked={checked(checklist, "toneChecked")} /><span><strong className="block text-white">Tone and audience checked</strong>Appropriate for the intended programme, audience and format.</span></label><label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200"><input className="mt-0.5" type="checkbox" name="hostRouteChecked" defaultChecked={checked(checklist, "hostRouteChecked")} /><span><strong className="block text-white">Host route checked</strong>Opening, pressure points and respectful questions are playable.</span></label><label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200"><input className="mt-0.5" type="checkbox" name="technicalChecked" defaultChecked={checked(checklist, "technicalChecked")} /><span><strong className="block text-white">Technical cues checked</strong>Voice, visuals and required sound cues are ready for rehearsal.</span></label></div></fieldset><label className="block"><span className="label">Producer notes</span><textarea className="field min-h-24" name="producerNotes" defaultValue={caller.producerNotes ?? ""} placeholder="Editorial direction, rehearsal notes, or changes needed before approval." /></label><button className="button-secondary" type="submit">Save review</button></form>
    </details>
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-700 pt-5"><form action={beginCallerRehearsalAction.bind(null, caller.id)}><button className="button-primary" type="submit">Log rehearsal pass</button></form><p className="text-sm text-slate-400">{caller.rehearsalCount === 0 ? "No rehearsal passes logged yet." : `${caller.rehearsalCount} rehearsal ${caller.rehearsalCount === 1 ? "pass" : "passes"} logged.`} {caller.status === "REHEARSING" ? "Caller is marked rehearsing." : "Logging a pass moves an unapproved draft into rehearsal."}</p></div>
  </section>;
}
