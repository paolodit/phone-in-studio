import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addSupportingVisualAction, approveCallerAction, deleteCallerAction, deleteCallerAssetAction, updateCallerAction } from "@/lib/actions/caller-actions";
import { CallerEditor } from "@/components/CallerEditor";
import { CallerImageFeedPicker } from "@/components/CallerImageFeedPicker";
import { CallerReviewPanel } from "@/components/CallerReviewPanel";
import { StudioNav } from "@/components/StudioNav";

export default async function CallerDetailPage({ params }: { params: Promise<{ callerId: string }> }) {
  await requireAdmin();
  const { callerId } = await params;
  const caller = await prisma.caller.findUniqueOrThrow({ where: { id: callerId }, include: { assets: true, _count: { select: { queueItems: true } } } });
  const visualAction = addSupportingVisualAction.bind(null, caller.id);

  return <main className="shell">
    <StudioNav />
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="eyebrow">Caller workshop / {caller.status}</p><h1 className="title mt-1">{caller.firstName} {caller.surnameInitial}</h1></div>
      <div className="flex gap-2">
        {caller.status !== "APPROVED" && <form action={approveCallerAction.bind(null, caller.id)}><button className="button-primary">Approve caller</button></form>}
        {caller._count.queueItems === 0 && <form action={deleteCallerAction.bind(null, caller.id)}><button className="button-danger">Delete draft</button></form>}
        <Link href="/callers" className="button-secondary">All callers</Link>
      </div>
    </div>
    <p className="mt-3 text-sm text-slate-300">Approval remains a deliberate producer action; it is never inferred from an automated score.</p>
    <div className="mt-6"><CallerReviewPanel caller={caller} /></div>
    <div className="mt-6"><CallerEditor action={updateCallerAction.bind(null, caller.id)} caller={caller} submitLabel="Save changes" /></div>

    <CallerImageFeedPicker defaultQuery={caller.issueHeadline} addVisual={visualAction} />

    <section className="panel panel-pad mt-6">
      <p className="eyebrow">Supporting visual library</p>
      <h2 className="mt-1 text-lg font-bold text-white">Prepared call visuals</h2>
      <p className="mt-2 text-sm text-slate-400">The host can switch any image on from the Studio’s Prepared visuals module. Queue a fresh caller snapshot after editing assets so a show retains the intended visual set.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {caller.assets.filter((asset) => asset.type === "SUPPORTING_VISUAL").map((asset) => <div key={asset.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950"><img className="h-28 w-full object-cover" src={asset.url} alt="" /><div className="p-3"><p className="font-semibold text-white">{asset.label}</p><p className="mt-1 text-xs text-slate-400">{asset.trigger || "Manual trigger"}{asset.manualHotkey ? ` · ${asset.manualHotkey}` : ""}</p><form action={deleteCallerAssetAction.bind(null, caller.id, asset.id)} className="mt-3"><button className="text-xs font-bold text-red-300 hover:text-red-100">Remove visual</button></form></div></div>)}
      </div>
      <form action={visualAction} className="mt-5 grid gap-3 border-t border-slate-700 pt-5 md:grid-cols-2">
        <label><span className="label">Visual label</span><input className="field" name="label" placeholder="Suspicious fridge display" required /></label>
        <label><span className="label">Image URL</span><input className="field" name="url" type="url" placeholder="https://..." required /></label>
        <label><span className="label">Natural trigger</span><input className="field" name="trigger" placeholder="When the caller claims the fridge is taking sides" /></label>
        <label><span className="label">Manual hotkey</span><input className="field" name="manualHotkey" maxLength={1} placeholder="1" /></label>
        <button className="button-secondary md:col-span-2 justify-self-start">Add supporting visual</button>
      </form>
    </section>
  </main>;
}
