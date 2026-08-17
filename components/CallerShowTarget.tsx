"use client";

import { Radio } from "lucide-react";

type ShowOption = {
  id: string;
  title: string;
  status: string;
};

export function CallerShowTarget({ shows, selectedShowId }: { shows: ShowOption[]; selectedShowId: string }) {
  const selectShow = (showId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("show", showId);
    window.location.assign(url.toString());
  };

  return <section className="panel panel-pad mt-4 flex flex-wrap items-center justify-between gap-4 border-cyan-300/25 bg-cyan-400/[0.04]">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Radio className="h-5 w-5" /></span>
      <div><p className="eyebrow">One-click queue</p><p className="mt-1 font-bold text-white">Choose the show once, then add callers directly from the list.</p><p className="mt-1 text-xs text-slate-400">New callers go to the end of its running order and appear in Host Studio immediately.</p></div>
    </div>
    <label className="min-w-[16rem]"><span className="label">Send callers to</span><select className="field !mt-1" value={selectedShowId} onChange={(event) => selectShow(event.target.value)}>{shows.map((show) => <option key={show.id} value={show.id}>{show.title} · {show.status.toLowerCase()}</option>)}</select></label>
  </section>;
}
