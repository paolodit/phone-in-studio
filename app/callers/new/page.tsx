import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createCallerAction } from "@/lib/actions/caller-actions";
import { CallerEditor } from "@/components/CallerEditor";
import { StudioNav } from "@/components/StudioNav";

export default async function NewCallerPage() {
  await requireAdmin();
  return <main className="shell"><StudioNav /><p className="eyebrow">Quick add</p><h1 className="title mt-1">Create a caller</h1><section className="panel mt-5 max-w-3xl p-4"><p className="text-sm text-slate-300"><b className="text-white">Name them, say where they are, and describe the call.</b> That is enough to save a working draft. Voice, character detail and graphics are available below only when you want them.</p><p className="mt-3 text-sm text-slate-400">Starting with a rough idea? <Link href="/callers/develop" className="font-semibold text-cyan-300 underline">Build with AI</Link> to explore six distinct callers first.</p></section><div className="mt-6"><CallerEditor action={createCallerAction} submitLabel="Save caller draft" /></div></main>;
}
