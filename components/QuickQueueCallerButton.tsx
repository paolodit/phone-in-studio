"use client";

import { Check, ListPlus } from "lucide-react";
import { useState } from "react";

export function QuickQueueCallerButton({ callerId, showId, showTitle, initiallyQueued }: { callerId: string; showId: string; showTitle: string; initiallyQueued: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "queued">(initiallyQueued ? "queued" : "idle");
  const [error, setError] = useState("");

  const addCaller = async () => {
    if (state !== "idle") return;
    setState("busy");
    setError("");
    try {
      const response = await fetch(`/api/shows/${showId}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerId }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to add caller to the show.");
      setState("queued");
    } catch (cause) {
      setState("idle");
      setError(cause instanceof Error ? cause.message : "Unable to add caller to the show.");
    }
  };

  return <div className="flex flex-col items-end gap-1">
    <button type="button" className={state === "queued" ? "button-secondary !min-h-9 !px-3 text-xs text-emerald-200" : "button-primary !min-h-9 !px-3 text-xs"} onClick={() => void addCaller()} disabled={state !== "idle"} title={state === "queued" ? `Already in ${showTitle}` : `Add to ${showTitle}`}>
      {state === "queued" ? <Check className="h-4 w-4" /> : <ListPlus className="h-4 w-4" />}
      <span>{state === "busy" ? "Adding…" : state === "queued" ? "In show" : "Add to show"}</span>
    </button>
    {error && <span className="max-w-48 text-right text-[11px] leading-4 text-rose-200" role="alert">{error}</span>}
  </div>;
}
