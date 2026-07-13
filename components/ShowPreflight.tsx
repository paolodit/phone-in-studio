import Link from "next/link";

type PreflightShow = {
  id: string;
  soundEffects: { id: string }[];
  queueItems: {
    id: string;
    position: number;
    status: string;
    caller: { firstName: string; surnameInitial: string | null; issueHeadline: string; rehearsalCount: number; assets: { type: string }[] };
  }[];
};

function Check({ ready, label, detail }: { ready: boolean; label: string; detail: string }) {
  return <div className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${ready ? "bg-emerald-400 text-emerald-950" : "bg-amber-300 text-amber-950"}`}>{ready ? "✓" : "!"}</span><div><p className="text-sm font-bold text-white">{label}</p><p className="mt-0.5 text-xs leading-5 text-slate-400">{detail}</p></div></div>;
}

export function ShowPreflight({ show }: { show: PreflightShow }) {
  const queued = show.queueItems.length;
  const rehearsed = show.queueItems.filter((item) => item.caller.rehearsalCount > 0).length;
  const withVisuals = show.queueItems.filter((item) => item.caller.assets.some((asset) => asset.type === "SUPPORTING_VISUAL")).length;
  return (
    <section className="panel panel-pad">
      <div className="flex items-start justify-between gap-4">
        <div><p className="eyebrow">Show preflight</p><h2 className="mt-1 text-lg font-bold text-white">Producer readiness</h2></div>
        <span className="status bg-slate-800 text-slate-200">{queued} in order</span>
      </div>
      <div className="mt-4 space-y-2">
        <Check ready={queued > 0} label="Running order" detail={queued > 0 ? `${queued} caller${queued === 1 ? "" : "s"} queued. Confirm the order below before a live start.` : "Add at least one approved caller before opening Host Studio."} />
        <Check ready={queued > 0 && rehearsed === queued} label="Rehearsal passes" detail={queued === 0 ? "No callers have been selected yet." : `${rehearsed}/${queued} queued callers have a rehearsal pass logged.`} />
        <Check ready={withVisuals > 0} label="Supporting visuals" detail={queued === 0 ? "No callers have been selected yet." : withVisuals > 0 ? `${withVisuals}/${queued} callers have prepared visual cues. They are optional, but useful for the broadcast layer.` : "No queued caller has a prepared supporting visual."} />
        <Check ready={true} label="Audio cues" detail={`${show.soundEffects.length} custom cue${show.soundEffects.length === 1 ? "" : "s"} configured; Host Studio also provides built-in incoming, connection, end-call and applause cues.`} />
        <Check ready={true} label="OBS display" detail="The show-specific Browser Source link is available above. Keep its token private and verify the source in your OBS scene." />
      </div>
      <div className="mt-4 border-t border-slate-700 pt-4">
        <p className="label">Quick run of show</p>
        <ol className="mt-2 space-y-2 text-sm">
          {show.queueItems.map((item) => <li key={item.id} className="flex gap-3"><span className="font-black text-cyan-300">{item.position}.</span><span className="text-slate-200"><strong className="text-white">{item.caller.firstName} {item.caller.surnameInitial}</strong> — {item.caller.issueHeadline}</span></li>)}
          {queued === 0 && <li className="text-slate-500">The cue sheet appears once callers are queued.</li>}
        </ol>
      </div>
      <Link href={`/studio?show=${show.id}`} className="button-primary mt-5 w-full">Open Host Studio for rehearsal</Link>
    </section>
  );
}
