import { CallerIdeaLab } from "@/components/CallerIdeaLab";
import { StudioNav } from "@/components/StudioNav";
import { requireAdmin } from "@/lib/auth";

export default async function DevelopCallerPage() {
  await requireAdmin();
  return <main className="shell"><StudioNav /><p className="eyebrow">Caller Workshop</p><h1 className="title mt-1">Develop a fictional caller with AI</h1><p className="mt-2 max-w-3xl text-sm text-slate-300">Use AI to explore and structure an idea, then edit it as a normal caller draft. It cannot approve, queue, or put a caller live.</p><div className="mt-6"><CallerIdeaLab /></div></main>;
}
