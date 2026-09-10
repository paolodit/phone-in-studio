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
  const remaining = show.queueItems.filter((item) => !["COMPLETED", "SKIPPED", "FAILED"].includes(item.status));
  const queued = remaining.length;
  const withVisuals = remaining.filter((item) => item.caller.assets.some((asset) => asset.type === "SUPPORTING_VISUAL")).length;
  return (
    <details className="panel panel-pad">
      <summary className="cursor-pointer text-sm font-bold text-slate-200">Optional setup checks <span className="ml-2 text-xs font-normal text-slate-400">{queued} remaining</span></summary>
      <div className="mt-4 space-y-2">
        <CheckItem ready={queued > 0} label="Running order" detail={queued > 0 ? `${queued} caller${queued === 1 ? "" : "s"} queued. Confirm the order before going live.` : "Add at least one approved caller before opening Host Studio."} />
        <CheckItem ready={true} label="Supporting visuals · optional" detail={queued === 0 ? "No callers have been selected yet." : withVisuals > 0 ? `${withVisuals}/${queued} callers have optional prepared visuals.` : "Portraits are enough to go live. Add topic images whenever useful."} />
        <CheckItem ready={true} label="Audio cues" detail={`${show.soundEffects.length} custom cue${show.soundEffects.length === 1 ? "" : "s"} configured; Host Studio also provides built-in call tones.`} />
        <CheckItem ready={true} label="Broadcast output" detail="The show-specific Browser Source link is available above. Keep its token private and verify it before the stream." />
      </div>
      <Link href={`/studio?show=${show.id}`} className="button-primary mt-5 w-full">Open Host Studio</Link>
    </details>
  );
}
