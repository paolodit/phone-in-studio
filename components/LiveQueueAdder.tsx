"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CallerOption = {
  id: string;
  firstName: string;
  surnameInitial: string | null;
  issueHeadline: string;
};

export function LiveQueueAdder({ showId, initialCallers, showIsLive }: { showId: string; initialCallers: CallerOption[]; showIsLive: boolean }) {
  const [callers, setCallers] = useState(initialCallers);
  const [callerId, setCallerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(showIsLive ? "Live producer lane is watching for newly approved callers." : "Add approved callers to build the running order.");

  const refreshCallers = useCallback(async () => {
    const response = await fetch("/api/callers/approved", { cache: "no-store" });
    if (response.ok) setCallers(await response.json() as CallerOption[]);
  }, []);

  useEffect(() => {
    void refreshCallers();
    if (!showIsLive) return;
    const interval = window.setInterval(() => void refreshCallers(), 4_000);
    return () => window.clearInterval(interval);
  }, [refreshCallers, showIsLive]);

  const addCaller = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!callerId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/shows/${showId}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerId }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to add caller to the queue.");
      const caller = callers.find((item) => item.id === callerId);
      setCallerId("");
      setMessage(`${caller?.firstName ?? "Caller"} is now at the end of the live running order. The Host Studio has updated.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add caller to the queue.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="panel panel-pad h-fit">
    <p className="eyebrow">{showIsLive ? "Live producer lane" : "Queue caller"}</p>
    <h2 className="mt-1 text-lg font-bold text-white">Drop a caller into the running order</h2>
    <p className="mt-2 text-sm leading-5 text-slate-400">Keep this page open on the producer&apos;s screen. A new approved caller appears here automatically; adding one updates the host&apos;s Studio immediately.</p>
    <div className="mt-3 flex flex-wrap gap-2"><Link href="/callers/develop" className="button-secondary text-xs">Create with AI workshop</Link><Link href="/callers/new" className="button-secondary text-xs">Create manually</Link></div>
    <form onSubmit={addCaller} className="mt-5">
      <label className="block"><span className="label">Approved caller</span><select className="field" value={callerId} onChange={(event) => setCallerId(event.target.value)} required><option value="" disabled>Select a caller</option>{callers.map((caller) => <option key={caller.id} value={caller.id}>{caller.firstName} {caller.surnameInitial ?? ""} — {caller.issueHeadline}</option>)}</select></label>
      <button type="submit" className="button-primary mt-4 w-full" disabled={busy || !callerId}>{busy ? "Adding caller…" : "Add to end of queue"}</button>
    </form>
    <p className="mt-3 text-xs leading-5 text-cyan-100" role="status">{message}</p>
  </section>;
}
