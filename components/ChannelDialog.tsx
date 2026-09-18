"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function ChannelDialog({ open, title, busy = false, onClose, children }: { open: boolean; title: string; busy?: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return <dialog ref={dialog} aria-label={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/85 backdrop:backdrop-blur-sm">
    <div className="p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><h2 className="text-xl font-bold text-white">{title}</h2><button type="button" disabled={busy} className="button-secondary !min-h-9 !w-9 shrink-0 !px-0" onClick={onClose} aria-label="Close dialog"><X className="h-4 w-4" /></button></div>{children}</div>
  </dialog>;
}
