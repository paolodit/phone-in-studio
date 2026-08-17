import Link from "next/link";
import { StudioNav } from "@/components/StudioNav";
import { updateCallerCandidateAction } from "@/lib/actions/caller-factory-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatedCallerDraftSchema } from "@/lib/schemas";

export default async function CandidateEditorPage({ params }: { params: Promise<{ candidateId: string }> }) {
  await requireAdmin();
  const { candidateId } = await params;
  const candidate = await prisma.callerCandidate.findUniqueOrThrow({ where: { id: candidateId }, include: { batch: true } });
  const draft = generatedCallerDraftSchema.parse(candidate.draft);
  return <main className="shell"><StudioNav /><p className="eyebrow"><Link href={`/callers/factory/${candidate.batchId}`}>Candidate batch</Link> / edit</p><h1 className="title mt-1">Shape {draft.firstName} before accepting</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Only the useful public and performance-facing fields are shown. The generated private structure remains intact.</p>
    {draft.autoVisuals?.status === "READY" && <section className="panel panel-pad mt-5 max-w-4xl"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="eyebrow">Prepared automatically</p><h2 className="mt-1 font-bold text-white">Topic visuals</h2></div><p className="text-xs text-slate-400">Editing the headline refreshes this set when you save.</p></div><div className="mt-3 grid grid-cols-3 gap-3">{draft.autoVisuals.items.map((image) => <div key={image.id} className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950"><img className="aspect-video w-full object-cover" src={image.previewUrl} alt={image.alt} /><p className="truncate p-2 text-[10px] text-slate-400">{image.creator} · {image.provider}</p></div>)}</div></section>}
    <form className="panel panel-pad mt-6 max-w-4xl" action={updateCallerCandidateAction.bind(null, candidate.id)}><div className="grid gap-4 md:grid-cols-3"><label><span className="label">First name</span><input className="field" name="firstName" defaultValue={draft.firstName} required /></label><label><span className="label">Surname initial</span><input className="field" name="surnameInitial" maxLength={1} defaultValue={draft.surnameInitial} /></label><label><span className="label">Age</span><input className="field" type="number" name="age" min="18" max="120" defaultValue={draft.age} required /></label><label><span className="label">Location</span><input className="field" name="location" defaultValue={draft.location} required /></label><label><span className="label">Occupation</span><input className="field" name="occupation" defaultValue={draft.occupation} required /></label><label><span className="label">Relationship status</span><input className="field" name="relationshipStatus" defaultValue={draft.relationshipStatus} required /></label></div>
      <label className="mt-4 block"><span className="label">Issue headline</span><input className="field" name="issueHeadline" defaultValue={draft.issueHeadline} required /></label><label className="mt-4 block"><span className="label">Opening summary</span><textarea className="field min-h-28" name="openingSummary" defaultValue={draft.openingSummary} required /></label><div className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="label">What they want from the call</span><textarea className="field min-h-24" name="desiredOutcome" defaultValue={draft.desiredOutcome} required /></label><label><span className="label">How they speak</span><textarea className="field min-h-24" name="speechStyle" defaultValue={draft.speechStyle} required /></label></div>
      <div className="mt-5 flex gap-2"><button className="button-primary">Save candidate</button><Link className="button-secondary" href={`/callers/factory/${candidate.batchId}`}>Cancel</Link></div>
    </form>
  </main>;
}
