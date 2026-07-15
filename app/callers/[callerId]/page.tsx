import Link from "next/link";
import { CheckCircle2, CircleAlert, Headphones, Images, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addSupportingVisualAction, approveCallerAction, deleteCallerAction, deleteCallerAssetAction, prepareTopicVisualsAction, updateCallerAction } from "@/lib/actions/caller-actions";
import { CallerEditor } from "@/components/CallerEditor";
import { CallerImageFeedPicker } from "@/components/CallerImageFeedPicker";
import { CallerImageGenerator } from "@/components/CallerImageGenerator";
import { CallerReviewPanel } from "@/components/CallerReviewPanel";
import { PrepareTopicVisualsButton } from "@/components/PrepareTopicVisualsButton";
import { StudioNav } from "@/components/StudioNav";

export default async function CallerDetailPage({ params }: { params: Promise<{ callerId: string }> }) {
  await requireAdmin();
  const { callerId } = await params;
  const caller = await prisma.caller.findUniqueOrThrow({ where: { id: callerId }, include: { assets: true, _count: { select: { queueItems: true } } } });
  const visualAction = addSupportingVisualAction.bind(null, caller.id);
  const prepareVisuals = prepareTopicVisualsAction.bind(null, caller.id);
  const visuals = caller.assets.filter((asset) => asset.type === "SUPPORTING_VISUAL");
  const approved = caller.status === "APPROVED";

  return <main className="shell"><StudioNav />
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Caller workshop</p><h1 className="title mt-1">{caller.firstName} {caller.surnameInitial}</h1><p className="mt-2 text-sm text-slate-400">Review the ready-made card first. Edit only what needs changing.</p></div><div className="flex flex-wrap gap-2"><Link href={`/callers/${caller.id}/test`} className="button-primary"><Headphones className="h-4 w-4" /> Test voice privately</Link><Link href="/callers" className="button-secondary">All callers</Link></div></div>

    <div className="sticky top-3 z-40 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-600/70 bg-slate-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="flex items-center gap-3">{approved ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <CircleAlert className="h-5 w-5 text-amber-300" />}<div><p className="text-sm font-bold text-white">{approved ? "Approved for shows" : "Draft — approval needed before queueing"}</p><p className="text-xs text-slate-400">{approved ? "This caller can be added to any show’s running order." : "Approve whenever the caller is usable; optional checks do not block approval."}</p></div></div>
      {!approved && <form action={approveCallerAction.bind(null, caller.id)}><button className="button-primary">Approve for shows</button></form>}
    </div>

    <div className="mt-6"><CallerEditor action={updateCallerAction.bind(null, caller.id)} caller={caller} submitLabel="Save changes" /></div>
    <div className="mt-4"><CallerReviewPanel caller={caller} /></div>

    <details className="panel panel-pad mt-6">
      <summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Images className="h-5 w-5 text-cyan-300" /><div><p className="font-bold text-white">Visuals and media</p><p className="mt-1 text-xs text-slate-400">{visuals.length} prepared visuals · stock search, AI generation and manual URLs</p></div></div><span className="text-xs font-bold text-cyan-200">Open tools</span></div></summary>
      <div className="mt-5 space-y-5 border-t border-slate-700 pt-5">
        <CallerImageFeedPicker callerId={caller.id} defaultQuery={caller.issueHeadline} existingVisualUrls={visuals.map((visual) => visual.url)} />
        <CallerImageGenerator defaultPrompt={caller.issueHeadline} callerId={caller.id} />
        <section className="rounded-xl border border-slate-700/70 bg-slate-950/30 p-4"><p className="eyebrow">Host visual tray</p><h2 className="mt-1 text-lg font-bold text-white">Prepared call visuals</h2><p className="mt-2 text-sm text-slate-400">The host manually chooses what reaches the broadcast. Prepare a topic-matched set or manage individual images here.</p><div className="mt-4"><PrepareTopicVisualsButton action={prepareVisuals} /></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">{visuals.map((asset) => <div key={asset.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950"><img className="h-28 w-full object-cover" src={asset.url} alt="" /><div className="p-3"><p className="line-clamp-2 font-semibold text-white">{asset.label}</p><p className="mt-1 text-xs text-slate-400">Manual host trigger{asset.manualHotkey ? ` · ${asset.manualHotkey}` : ""}</p><form action={deleteCallerAssetAction.bind(null, caller.id, asset.id)} className="mt-3"><button className="text-xs font-bold text-rose-200 hover:text-rose-100">Remove visual</button></form></div></div>)}</div>
          {visuals.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">No visuals prepared yet. Prepare a topic-matched set or add one from the image feed.</p>}
          <details className="mt-5 rounded-xl border border-slate-700/70 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-300">Add a visual from a URL</summary><form action={visualAction} className="mt-4 grid gap-3 md:grid-cols-2"><label><span className="label">Visual label</span><input className="field" name="label" placeholder="A useful visual cue" required /></label><label><span className="label">Image URL</span><input className="field" name="url" type="url" placeholder="https://..." required /></label><label><span className="label">Manual hotkey</span><input className="field" name="manualHotkey" maxLength={1} placeholder="1" /></label><button className="button-secondary self-end justify-self-start">Add visual</button></form></details>
        </section>
      </div>
    </details>

    {caller._count.queueItems === 0 && <details className="mt-6 rounded-xl border border-rose-400/15 bg-rose-950/10 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-500">Draft actions</summary><form action={deleteCallerAction.bind(null, caller.id)} className="mt-4"><button className="button-danger"><Trash2 className="h-4 w-4" /> Delete draft</button></form></details>}
  </main>;
}
