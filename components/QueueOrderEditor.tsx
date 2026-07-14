"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { moveQueueEntry } from "@/lib/queue-order";

export type QueueOrderItem = {
  id: string;
  position: number;
  name: string;
  issue: string;
  status: string;
};

function withPositions(items: QueueOrderItem[]) {
  return items.map((item, index) => ({ ...item, position: index + 1 }));
}

const finishedStatuses = new Set(["COMPLETED", "SKIPPED", "FAILED"]);

export function QueueOrderEditor({
  showId,
  items: initialItems,
  onReordered,
  refreshOnReorder = true,
}: {
  showId: string;
  items: QueueOrderItem[];
  onReordered?: () => void | Promise<void>;
  refreshOnReorder?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setItems(initialItems), [initialItems]);

  const refresh = async () => {
    await onReordered?.();
    if (refreshOnReorder) router.refresh();
  };

  const persistOrder = async (next: QueueOrderItem[]) => {
    const previous = items;
    const positioned = withPositions(next);
    setItems(positioned);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/shows/${showId}/queue`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueItemIds: positioned.map((item) => item.id) }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to reorder the callers.");
      await refresh();
    } catch (caught) {
      setItems(previous);
      setError(caught instanceof Error ? caught.message : "Unable to reorder the callers.");
    } finally {
      setSaving(false);
      setDraggingId(null);
    }
  };

  const move = (movingId: string, targetId: string) => {
    const moving = items.find((item) => item.id === movingId);
    const target = items.find((item) => item.id === targetId);
    if (!moving || !target || moving.status !== "QUEUED" || target.status !== "QUEUED" || saving) return;
    void persistOrder(moveQueueEntry(items, movingId, targetId));
  };

  const reactivate = async (item: QueueOrderItem) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/shows/${showId}/queue`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueItemId: item.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to reactivate the caller.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reactivate the caller.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="mt-4 space-y-2" aria-label="Caller running order">
    <p className="text-xs text-slate-400">Drag queued callers to reorder them. Reactivate a finished caller to unlock its position, then drag it into the running order.</p>
    {items.map((item) => {
      const movable = item.status === "QUEUED";
      const canReactivate = finishedStatuses.has(item.status);
      return <div
        key={item.id}
        data-testid={`queue-item-${item.id}`}
        draggable={movable && !saving}
        onDragStart={() => setDraggingId(item.id)}
        onDragEnd={() => setDraggingId(null)}
        onDragOver={(event) => { if (movable && draggingId && !saving) event.preventDefault(); }}
        onDrop={(event) => { event.preventDefault(); if (draggingId) move(draggingId, item.id); }}
        className={`flex items-center gap-3 rounded-xl border bg-slate-950/60 p-3 transition ${movable ? "cursor-grab border-slate-700 hover:border-cyan-400 active:cursor-grabbing" : "border-slate-800 opacity-75"} ${draggingId === item.id ? "border-cyan-300 bg-cyan-400/10" : ""}`}
      >
        <span aria-hidden="true" className={`text-lg ${movable ? "text-cyan-300" : "text-slate-600"}`}>⋮⋮</span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-800 text-xs font-bold">{item.position}</span>
        <div className="min-w-0 flex-1"><p className="font-semibold text-white">{item.name}</p><p className="truncate text-xs text-slate-400">{item.issue}</p></div>
        <span className="status bg-slate-800 text-slate-300">{item.status}</span>
        {canReactivate && <button type="button" className="button-secondary !min-h-8 !w-8 !px-0 text-base" disabled={saving} onClick={() => void reactivate(item)} aria-label={`Reactivate ${item.name}`} title="Reactivate caller">↻</button>}
      </div>;
    })}
    {items.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">The running order is empty.</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-900/30 p-3 text-sm text-rose-100">{error}</p>}
  </div>;
}
