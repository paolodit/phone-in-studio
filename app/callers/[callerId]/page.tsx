import Link from "next/link";
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

  return <main className="shell"><StudioNav />
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Caller workshop / {caller.status}</p><h1 className="title mt-1">{caller.firstName} {caller.surnameInitial}</h1></div><div className="flex gap-2">{caller.status !== "APPROVED" && <form action={approveCallerAction.bind(null, caller.id)}><button className="button-primary">Approve caller</button></form>}{caller._count.queueItems === 0 && <form action={deleteCallerAction.bind(null, caller.id)}><button className="button-danger">Delete draft</button></form>}<Link href="/callers" className="button-secondary">All callers</Link></div></div>
    <p className="mt-3 text-sm text-slate-300">Approval remains a deliberate producer action; it is never inferred from an automated score.</p>
    <div className="mt-6"><CallerReviewPanel caller={caller} /></div>
    <div className="mt-6"><CallerEditor action={updateCallerAction.bind(null, caller.id)} caller={caller} submitLabel="Save changes" /></div>

    <CallerImageFeedPicker defaultQuery={caller.issueHeadline} addVisual={visualAction} />
    <div className="mt-6"><CallerImageGenerator defaultPrompt={caller.issueHeadline} callerId={caller.id} /></div>

    <section className="panel panel-pad mt-6"><p className="eyebrow">Supporting visual library</p><h2 className="mt-1 text-lg font-bold text-white">Prepared call visuals</h2><p className="mt-2 text-sm text-slate-400">The host chooses every visual manually from Studio’s Visuals panel. Start with a topic-matched set, or search and add individual images above.</p><div className="mt-4"><PrepareTopicVisualsButton action={prepareVisuals} /></div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">{visuals.map((asset) => <div key={asset.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950"><img className="h-28 w-full object-cover" src={asset.url} alt="" /><div className="p-3"><p className="font-semibold text-white">{asset.label}</p><p className="mt-1 text-xs text-slate-400">Manual host trigger{asset.manualHotkey ? ` · ${asset.manualHotkey}` : ""}</p><form action={deleteCallerAssetAction.bind(null, caller.id, asset.id)} className="mt-3"><button className="text-xs font-bold text-rose-200 hover:text-rose-100">Remove visual</button></form></div></div>)}</div>
      {visuals.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">No visuals prepared yet. Prepare the topic-matched set or add one from the image feed.</p>}
      <form action={visualAction} className="mt-5 grid gap-3 border-t border-slate-700 pt-5 md:grid-cols-2"><label><span className="label">Visual label</span><input className="field" name="label" placeholder="A useful visual cue" required /></label><label><span className="label">Image URL</span><input className="field" name="url" type="url" placeholder="https://..." required /></label><label><span className="label">Manual hotkey</span><input className="field" name="manualHotkey" maxLength={1} placeholder="1" /></label><button className="button-secondary self-end justify-self-start">Add visual</button></form>
    </section>
  </main>;
}
