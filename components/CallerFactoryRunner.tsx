"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Play } from "lucide-react";

export function CallerFactoryRunner({ batchId, status, generatedCount, targetCount }: { batchId: string; status: string; generatedCount: number; targetCount: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(status === "DRAFT" ? "Ready to develop the first two candidates." : "Generation can resume from the saved progress.");
  const stopped = useRef(false);

  async function run() {
    if (running || generatedCount >= targetCount) return;
    stopped.current = false;
    setRunning(true);
    setMessage("Developing the next two distinct callers…");
    try {
      let count = generatedCount;
      while (!stopped.current && count < targetCount) {
        const response = await fetch(`/api/caller-factory/batches/${batchId}/generate`, { method: "POST" });
        const result = await response.json() as { batch?: { generatedCount: number; targetCount: number; status: string }; error?: string };
        if (!response.ok || !result.batch) throw new Error(result.error ?? "This batch could not continue.");
        count = result.batch.generatedCount;
        setMessage(`${count}/${targetCount} candidates staged. ${count < targetCount ? "Developing the next pair…" : "Pack complete."}`);
        router.refresh();
        if (["PAUSED", "CANCELLED", "FAILED", "COMPLETED"].includes(result.batch.status)) break;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Caller generation stopped.");
      router.refresh();
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  useEffect(() => () => { stopped.current = true; }, []);
  return <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-white">{generatedCount}/{targetCount} candidates staged</p><p className="mt-1 text-xs text-slate-400" role="status">{message}</p></div><button className="button-primary" type="button" disabled={running || generatedCount >= targetCount || status === "CANCELLED" || status === "PAUSED"} onClick={() => void run()}>{running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {running ? "Building pack…" : generatedCount ? "Continue batch" : "Build caller pack"}</button></div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${Math.min(100, (generatedCount / targetCount) * 100)}%` }} /></div>
  </div>;
}
