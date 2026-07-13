import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createCallerAction } from "@/lib/actions/caller-actions";
import { CallerEditor } from "@/components/CallerEditor";
import { StudioNav } from "@/components/StudioNav";

export default async function NewCallerPage() {
  await requireAdmin();
  return <main className="shell"><StudioNav /><p className="eyebrow">Stage 1 — Manual seed</p><h1 className="title mt-1">Create a fictional caller</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">This creates a draft only. Review and approve it manually before it can enter a live queue. Want help exploring an idea first? <Link href="/callers/develop" className="font-semibold text-cyan-300 underline">Open Caller Workshop</Link>.</p><div className="mt-6"><CallerEditor action={createCallerAction} submitLabel="Save draft caller" /></div></main>;
}
