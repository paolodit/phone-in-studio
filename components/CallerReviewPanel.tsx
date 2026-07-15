import { ClipboardCheck } from "lucide-react";
import { saveCallerReviewAction } from "@/lib/actions/caller-actions";

type ReviewCaller = {
  id: string;
  status: string;
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

  return <details className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-4">
    <summary className="cursor-pointer list-none">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><ClipboardCheck className="h-5 w-5 text-slate-400" /><div><p className="text-sm font-bold text-slate-100">Optional producer checks</p><p className="mt-0.5 text-xs text-slate-500">Useful for higher-risk or reusable callers; not required before moving on.</p></div></div><span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-slate-400">{checkedCount}/4 checks</span></div>
    </summary>
    <div className="mt-4 border-t border-slate-700/70 pt-4">
      {workshopNotes.length > 0 && <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-950/20 p-3"><p className="text-xs font-bold uppercase tracking-wide text-amber-200">Workshop notes</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-50/80">{workshopNotes.map((note) => <li key={note}>{note}</li>)}</ul></div>}
      <form action={saveCallerReviewAction.bind(null, caller.id)} className="space-y-4">
        <fieldset><legend className="label">Quick checks</legend><div className="mt-3 grid gap-2 md:grid-cols-2"><label className="flex items-center gap-3 rounded-lg border border-slate-700/70 p-3 text-sm text-slate-200"><input type="checkbox" name="fictionalRightsChecked" defaultChecked={checked(checklist, "fictionalRightsChecked")} />Fictional and rights-safe</label><label className="flex items-center gap-3 rounded-lg border border-slate-700/70 p-3 text-sm text-slate-200"><input type="checkbox" name="toneChecked" defaultChecked={checked(checklist, "toneChecked")} />Tone suits the show</label><label className="flex items-center gap-3 rounded-lg border border-slate-700/70 p-3 text-sm text-slate-200"><input type="checkbox" name="hostRouteChecked" defaultChecked={checked(checklist, "hostRouteChecked")} />Host has a clear route</label><label className="flex items-center gap-3 rounded-lg border border-slate-700/70 p-3 text-sm text-slate-200"><input type="checkbox" name="technicalChecked" defaultChecked={checked(checklist, "technicalChecked")} />Voice and visuals checked</label></div></fieldset>
        <label className="block"><span className="label">Optional notes</span><textarea className="field min-h-20" name="producerNotes" defaultValue={caller.producerNotes ?? ""} placeholder="Only add notes when the caller needs special handling." /></label>
        <button className="button-secondary" type="submit">Save optional checks</button>
      </form>
    </div>
  </details>;
}
