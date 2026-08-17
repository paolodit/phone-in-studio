import { CallerIdeaLab } from "@/components/CallerIdeaLab";
import { StudioNav } from "@/components/StudioNav";
import { requireAdmin } from "@/lib/auth";

export default async function DevelopCallerPage() {
  await requireAdmin();
  return <main className="shell"><StudioNav /><p className="eyebrow">AI caller builder</p><h1 className="title mt-1">Turn one thought into a caller pack</h1><p className="mt-2 max-w-3xl text-sm text-slate-300">Give the workshop a sentence. It will return six different ways into the call, then build the production notes behind your choice. Nothing is approved or queued automatically.</p><div className="mt-6"><CallerIdeaLab /></div></main>;
}
