import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createCallerAction } from "@/lib/actions/caller-actions";
import { CallerEditor } from "@/components/CallerEditor";
import { StudioNav } from "@/components/StudioNav";

export default async function NewCallerPage() {
  await requireAdmin();
  return <main className="shell"><StudioNav /><p className="eyebrow">Stage 1 — Manual seed</p><h1 className="title mt-1">Create a fictional caller</h1><section className="panel mt-5 max-w-3xl p-4"><p className="eyebrow">How this works</p><ol className="mt-2 grid gap-1 text-sm text-slate-300 md:grid-cols-3"><li><b className="text-white">1. Shape</b> the public caller and their private card.</li><li><b className="text-white">2. Save</b> an editable, unapproved draft.</li><li><b className="text-white">3. Review</b> and approve it before it can be queued.</li></ol><p className="mt-3 text-sm text-slate-400">Prefer to start from an idea instead? <Link href="/callers/develop" className="font-semibold text-cyan-300 underline">Open Caller Workshop</Link> to generate a pack of routes first.</p></section><div className="mt-6"><CallerEditor action={createCallerAction} submitLabel="Save draft caller" /></div></main>;
}
