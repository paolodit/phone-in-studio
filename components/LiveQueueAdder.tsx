"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Search } from "lucide-react";

type CallerOption = { id: string; firstName: string; surnameInitial: string | null; issueHeadline: string };

export function LiveQueueAdder({ showId, initialCallers, showIsLive, queuedCallerIds = [] }: {
  showId: string; initialCallers: CallerOption[]; showIsLive: boolean; queuedCallerIds?: string[];
}) {
  const router = useRouter();
  const [callers, setCallers] = useState(initialCallers);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [queued, setQueued] = useState(new Set(queuedCallerIds));
  const [message, setMessage] = useState("");
  useEffect(() => { setQueued(new Set(queuedCallerIds)); }, [queuedCallerIds]);
  const refreshCallers = useCallback(async () => {
    try {
      const response = await fetch("/api/callers/approved", { cache: "no-store" });
      if (response.ok) setCallers(await response.json() as CallerOption[]);
    } catch { /* Keep the last known list if the network drops. */ }
  }, []);
  useEffect(() => {
    void refreshCallers();
    if (!showIsLive) return;
    const interval = window.setInterval(() => void refreshCallers(), 4_000);
    return () => window.clearInterval(interval);
  }, [refreshCallers, showIsLive]);

  const addCaller = async (caller: CallerOption) => {
    if (adding || queued.has(caller.id)) return;
    setAdding(caller.id);
    try {
      const response = await fetch(`/api/shows/${showId}/queue`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callerId: caller.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to add caller.");
      setQueued((current) => new Set([...current, caller.id]));
      setMessage(`${caller.firstName} added to the end of the running order.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add caller."); }
    finally { setAdding(null); }
  };
  const matches = callers.filter((caller) => `${caller.firstName} ${caller.surnameInitial ?? ""} ${caller.issueHeadline}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => `${a.firstName} ${a.surnameInitial ?? ""}`.localeCompare(`${b.firstName} ${b.surnameInitial ?? ""}`));
  // Keep recently added rows in place so the confirmation doesn't disappear.
  return <section className="panel panel-pad h-fit">
    <p className="eyebrow">{showIsLive ? "Live producer lane" : "Build your line-up"}</p>
    <h2 className="mt-1 text-lg font-bold text-white">Add a caller</h2>
    <p className="mt-2 text-xs leading-5 text-slate-400">One click sends a ready caller to this show. The studio updates without interrupting the current call.</p>
    <label className="relative mt-3 block"><span className="sr-only">Find a ready caller</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input className="field !pl-9" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or topic…" /></label>
    <ul className="mt-3 max-h-80 divide-y divide-slate-800 overflow-y-auto">
      {matches.map((caller) => <li key={caller.id} className="flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1"><Link href={`/callers/${caller.id}`} className="text-sm font-bold text-white hover:text-cyan-200">{caller.firstName} {caller.surnameInitial}</Link><p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-400">{caller.issueHeadline}</p></div>
        <button type="button" onClick={() => void addCaller(caller)} disabled={!!adding || queued.has(caller.id)} className={`button-secondary !min-h-8 !px-2 text-xs ${queued.has(caller.id) ? "!bg-cyan-300/10 !text-cyan-200 !opacity-100" : ""}`} aria-label={`${queued.has(caller.id) ? "In show:" : "Add to show:"} ${caller.firstName}`}>{queued.has(caller.id) ? <Check className="h-4 w-4" /> : adding === caller.id ? "…" : <Plus className="h-4 w-4" />}</button>
      </li>)}
      {!matches.length && <li className="py-5 text-sm text-slate-400">No ready callers match. Try another search or build a new caller.</li>}
    </ul>
    {message && <p className="mt-2 rounded-lg bg-cyan-400/5 p-2 text-xs text-cyan-100" role="status">{message}</p>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3"><Link href={`/callers?show=${showId}`} className="text-xs font-bold text-cyan-200">Browse all callers →</Link><Link href="/callers/develop" className="text-xs font-bold text-slate-300">Build with AI</Link></div>
  </section>;
}
