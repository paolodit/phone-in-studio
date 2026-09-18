"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { ChannelDialog } from "@/components/ChannelDialog";

export function DeleteChannelDialog({ id, title, live, action }: { id: string; title: string; live: boolean; action: (state: { error?: string }, form: FormData) => Promise<{ error?: string }> }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState(action, {});
  return <>
    <button type="button" className="button-danger" onClick={() => { setConfirmation(""); setOpen(true); }}><Trash2 className="h-4 w-4" />Delete channel</button>
    <ChannelDialog open={open} title={`Delete “${title}”?`} busy={pending} onClose={() => setOpen(false)}>
      <p className="mt-4 text-sm leading-6 text-slate-300">Permanently removes this channel, its running order, event/transcript history, custom sound cues, settings and broadcast link. This cannot be undone.</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">Caller cards, their images and presenter profiles stay in your library. Caller Factory batches are kept without this channel; its saved show plan becomes a draft again. Other channels are unchanged.</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">Browser recordings are not deleted. <Link href={`/shows/${id}/recordings`} className="text-cyan-200 underline">Review or download recordings</Link> before deleting; that recordings link remains usable afterward.</p>
      {live ? <div className="mt-5 rounded-xl bg-amber-300/10 p-4"><p className="text-sm text-amber-100">This channel is live. End the show in Studio first; deletion will not interrupt a broadcast.</p><Link className="button-secondary mt-3" href={`/studio?show=${id}`}>Open Studio</Link></div> : <form action={formAction} className="mt-5 space-y-4"><label className="block"><span className="label">Type {title} to confirm</span><input name="confirmation" className="field" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required disabled={pending} /></label>{state.error && <p role="alert" className="text-sm text-rose-200">{state.error}</p>}<div className="flex flex-wrap justify-end gap-3"><button type="button" className="button-secondary" disabled={pending} onClick={() => setOpen(false)}>Keep channel</button><button className="button-danger" disabled={pending || confirmation !== title}>{pending ? "Deleting…" : "Permanently delete channel"}</button></div></form>}
    </ChannelDialog>
  </>;
}
