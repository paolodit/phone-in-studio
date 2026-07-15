import Link from "next/link";
import { Check, CircleAlert } from "lucide-react";

type PreflightShow = {
  id: string;
  soundEffects: { id: string }[];
  queueItems: {
    id: string;
    position: number;
    status: string;
    caller: { firstName: string; surnameInitial: string | null; issueHeadline: string; assets: { type: string }[] };
  }[];
};

function CheckItem({ ready, label, detail }: { ready: boolean; label: string; detail: string }) {
  const Icon = ready ? Check : CircleAlert;
  return <div className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${ready ? "bg-emerald-400 text-emerald-950" : "bg-amber-300 text-amber-950"}`}><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span><div><p className="text-sm font-bold text-white">{label}</p><p className="mt-0.5 text-xs leading-5 text-slate-400">{detail}</p></div></div>;
}

export function ShowPreflight({ show }: { show: PreflightShow }) {
  const queued = show.queueItems.length;
  const withVisuals = show.queueItems.filter((item) => item.caller.assets.some((asset) => asset.type === "SUPPORTING_VISUAL")).length;
  return (
    <section className="panel panel-pad">
      <div className="flex items-start justify-between gap-4">
        <div><p className="eyebrow">Show setup</p><h2 className="mt-1 text-lg font-bold text-white">At a glance</h2></div>
        <span className="status bg-slate-800 text-slate-200">{queued} in order</span>
      </div>
      <div className="mt-4 space-y-2">
        <CheckItem ready={queued > 0} label="Running order" detail={queued > 0 ? `${queued} caller${queued === 1 ? "" : "s"} queued. Confirm the order before going live.` : "Add at least one approved caller before opening Host Studio."} />
        <CheckItem ready={withVisuals > 0} label="Supporting visuals" detail={queued === 0 ? "No callers have been selected yet." : withVisuals > 0 ? `${withVisuals}/${queued} callers have optional prepared visuals.` : "No supporting visuals are prepared; the show can still go live."} />
        <CheckItem ready={true} label="Audio cues" detail={`${show.soundEffects.length} custom cue${show.soundEffects.length === 1 ? "" : "s"} configured; Host Studio also provides built-in call tones.`} />
        <CheckItem ready={true} label="Broadcast output" detail="The show-specific Browser Source link is available above. Keep its token private and verify it before the stream." />
      </div>
      <div className="mt-4 border-t border-slate-700 pt-4">
        <p className="label">Quick running order</p>
        <ol className="mt-2 space-y-2 text-sm">
          {show.queueItems.map((item) => <li key={item.id} className="flex gap-3"><span className="font-black text-cyan-300">{item.position}.</span><span className="text-slate-200"><strong className="text-white">{item.caller.firstName} {item.caller.surnameInitial}</strong> — {item.caller.issueHeadline}</span></li>)}
          {queued === 0 && <li className="text-slate-500">The running order appears once callers are queued.</li>}
        </ol>
      </div>
      <Link href={`/studio?show=${show.id}`} className="button-primary mt-5 w-full">Open Host Studio</Link>
    </section>
  );
}
