"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PrepareTopicVisualsButton({ action }: { action: () => Promise<void> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function prepare() {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      router.refresh();
      setMessage("Three topic-matched visuals are ready for the host to trigger manually.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to prepare topic visuals.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-wrap items-center gap-3"><button type="button" className="button-secondary" disabled={busy} onClick={() => void prepare()}>{busy ? "Finding topic visuals…" : "Prepare 3 topic visuals"}</button>{message && <p className="text-xs text-slate-300" role="status">{message}</p>}</div>;
}
