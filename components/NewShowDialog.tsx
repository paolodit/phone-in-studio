"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

export function NewShowDialog({ action, initialOpen = false }: { action: (formData: FormData) => void | Promise<void>; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has("new")) {
      url.searchParams.delete("new");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" className="button-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New show</button>
    {open && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <section className="panel panel-pad w-full max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="new-show-title">
        <div className="flex items-start justify-between gap-4">
          <div><p className="eyebrow">New show</p><h2 id="new-show-title" className="mt-1 text-xl font-bold text-white">Create a show workspace</h2><p className="mt-2 text-sm text-slate-400">This gives the show its own Studio, running order, private broadcast link and options.</p></div>
          <button type="button" className="button-secondary !min-h-9 !w-9 !px-0" onClick={close} aria-label="Close new show form"><X className="h-4 w-4" /></button>
        </div>
        <form action={action} className="mt-5">
          <label><span className="label">Show title</span><input className="field" name="title" placeholder="Friday night phone-in" autoFocus required /></label>
          <div className="mt-5 flex justify-end gap-2"><button type="button" className="button-secondary" onClick={close}>Cancel</button><button className="button-primary"><Plus className="h-4 w-4" /> Create show</button></div>
        </form>
      </section>
    </div>}
  </>;
}
