"use client";

import { useState } from "react";
import type { CallerPremise, GeneratedCallerDraft } from "@/lib/schemas";

type BusyAction = "premises" | "develop" | "save" | null;
type SavedDraft = { callerId: string; editUrl: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as { error?: unknown } | T | null;
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return payload as T;
}

export function CallerIdeaLab() {
  const [sourceNotes, setSourceNotes] = useState("");
  const [premises, setPremises] = useState<CallerPremise[]>([]);
  const [selectedPremise, setSelectedPremise] = useState<CallerPremise | null>(null);
  const [draft, setDraft] = useState<GeneratedCallerDraft | null>(null);
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);

  async function generatePremises() {
    setBusy("premises");
    setError(null);
    setDraft(null);
    setSavedDraft(null);
    try {
      const result = await postJson<{ premises: CallerPremise[] }>("/api/caller-workshop/premises", { sourceNotes });
      setPremises(result.premises);
      setSelectedPremise(result.premises[0] ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to generate premises.");
    } finally {
      setBusy(null);
    }
  }

  async function developSelectedPremise() {
    if (!selectedPremise) return;
    setBusy("develop");
    setError(null);
    setSavedDraft(null);
    try {
      const result = await postJson<{ draft: GeneratedCallerDraft }>("/api/caller-workshop/develop", { sourceNotes, premise: selectedPremise });
      setDraft(result.draft);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to develop this caller.");
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft() {
    if (!selectedPremise || !draft || savedDraft) return;
    setBusy("save");
    setError(null);
    try {
      const result = await postJson<{ callerId: string; editUrl?: string }>("/api/caller-workshop/save", { sourceNotes, premise: selectedPremise, draft });
      const saved = { callerId: result.callerId, editUrl: result.editUrl ?? `/callers/${result.callerId}` };
      setSavedDraft(saved);
      window.setTimeout(() => window.location.assign(saved.editUrl), 350);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save this caller draft.");
    } finally {
      setBusy(null);
    }
  }

  return <div className="space-y-6">
    <section className="panel panel-pad">
      <p className="eyebrow">Step 1 - Producer seed</p>
      <h2 className="mt-1 text-xl font-bold text-white">Give the room a starting spark</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">Describe a situation, observation, prop, local texture, or comic disagreement. The workshop creates fictional adult callers only.</p>
      <label className="mt-5 block"><span className="label">Seed / source notes</span><textarea className="field min-h-36" value={sourceNotes} onChange={(event) => { setSourceNotes(event.target.value); setPremises([]); setSelectedPremise(null); setDraft(null); setSavedDraft(null); }} placeholder="For example: a caller believes a neighbourhood book-swap shelf is enforcing a bizarre hierarchy, but they have been quietly replacing the books they dislike." /></label>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button className="button-primary" type="button" onClick={generatePremises} disabled={busy !== null || sourceNotes.trim().length < 12}>{busy === "premises" ? "Finding angles..." : "Generate six premise options"}</button><span className="text-xs text-slate-500">Nothing is saved at this step.</span></div>
    </section>

    {error && <div role="alert" className="rounded-xl border border-red-400/50 bg-red-950/50 px-4 py-3 text-sm text-red-100">{error}</div>}

    {premises.length > 0 && <section className="space-y-4">
      <div><p className="eyebrow">Step 2 - Shortlist</p><h2 className="mt-1 text-xl font-bold text-white">Choose a comic engine to develop</h2></div>
      <div className="grid gap-4 lg:grid-cols-2">{premises.map((premise, index) => {
        const isSelected = selectedPremise?.title === premise.title;
        return <article key={`${premise.title}-${index}`} className={`panel panel-pad border ${isSelected ? "border-cyan-300" : "border-slate-700/70"}`}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Option {index + 1}</p><h3 className="mt-1 text-lg font-bold text-white">{premise.title}</h3></div><button className={isSelected ? "button-primary" : "button-secondary"} type="button" onClick={() => { setSelectedPremise(premise); setDraft(null); setSavedDraft(null); }}>{isSelected ? "Selected" : "Select"}</button></div>
          <p className="mt-3 text-sm text-slate-200">{premise.setup}</p>
          <dl className="mt-4 grid gap-3 text-sm"><div><dt className="label">Caller view</dt><dd className="mt-1 text-slate-300">{premise.callerPointOfView}</dd></div><div><dt className="label">Contradiction</dt><dd className="mt-1 text-slate-300">{premise.comicContradiction}</dd></div><div><dt className="label">Host challenge</dt><dd className="mt-1 text-slate-300">{premise.hostChallenge}</dd></div><div><dt className="label">Escalation</dt><dd className="mt-1 text-slate-300">{premise.escalationPossibility}</dd></div><div><dt className="label">Originality check</dt><dd className="mt-1 text-amber-200">{premise.originalityWarning}</dd></div></dl>
        </article>;
      })}</div>
      <div className="panel panel-pad flex flex-wrap items-center justify-between gap-4"><div><p className="font-bold text-white">{selectedPremise ? selectedPremise.title : "Select an option"}</p><p className="mt-1 text-sm text-slate-400">This turns one chosen option into an editable private caller card.</p></div><button className="button-primary" type="button" onClick={developSelectedPremise} disabled={!selectedPremise || busy !== null}>{busy === "develop" ? "Developing caller..." : "Develop selected caller"}</button></div>
    </section>}

    {draft && <section className="space-y-4">
      <div><p className="eyebrow">Step 3 - Draft review</p><h2 className="mt-1 text-xl font-bold text-white">{draft.firstName} {draft.surnameInitial} - {draft.issueHeadline}</h2><p className="mt-2 max-w-3xl text-sm text-slate-300">This is a private, unapproved production draft. Save it to the normal caller editor to revise it; approval remains a separate deliberate action.</p></div>
      {savedDraft ? <div className="rounded-2xl border border-emerald-300/50 bg-emerald-400/10 p-4 text-sm text-emerald-50"><p className="font-bold">Draft saved.</p><p className="mt-1">Opening the normal caller editor now. If it does not open, <a className="font-bold underline" href={savedDraft.editUrl}>open the editable draft</a>.</p></div> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/40 bg-cyan-400/10 p-4"><p className="text-sm text-cyan-50"><b>Next:</b> save this candidate to create its editable caller draft. Nothing is approved or queued by this step.</p><button className="button-primary" type="button" onClick={saveDraft} disabled={busy !== null}>{busy === "save" ? "Saving editable draft..." : "Save and open editor"}</button></div>}
      <div className="grid gap-4 lg:grid-cols-2"><article className="panel panel-pad"><h3 className="font-bold text-white">Public caller frame</h3><dl className="mt-4 grid gap-3 text-sm"><div><dt className="label">Identity</dt><dd className="mt-1 text-slate-200">{draft.age}, {draft.location} - {draft.occupation}</dd></div><div><dt className="label">Relationship status</dt><dd className="mt-1 text-slate-200">{draft.relationshipStatus}</dd></div><div><dt className="label">Opening summary</dt><dd className="mt-1 text-slate-200">{draft.openingSummary}</dd></div><div><dt className="label">Speech style</dt><dd className="mt-1 text-slate-200">{draft.speechStyle}</dd></div></dl></article>
        <article className="panel panel-pad"><h3 className="font-bold text-white">Private comic card</h3><dl className="mt-4 grid gap-3 text-sm"><div><dt className="label">Central want</dt><dd className="mt-1 text-slate-200">{draft.centralWant}</dd></div><div><dt className="label">Actual behaviour</dt><dd className="mt-1 text-slate-200">{draft.actualBehaviour}</dd></div><div><dt className="label">Contradiction</dt><dd className="mt-1 text-slate-200">{draft.comicContradiction}</dd></div><div><dt className="label">Hidden truth</dt><dd className="mt-1 text-slate-200">{draft.hiddenTruth}</dd></div></dl></article></div>
      <div className="grid gap-4 lg:grid-cols-2"><article className="panel panel-pad"><h3 className="font-bold text-white">Escalation beats</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">{draft.escalationBeats.map((beat) => <li key={beat}>{beat}</li>)}</ol></article><article className="panel panel-pad"><h3 className="font-bold text-white">Suggested host questions</h3><ul className="mt-3 space-y-2 text-sm text-slate-300">{draft.suggestedQuestions.map((question) => <li key={question}>- {question}</li>)}</ul></article></div>
      <article className="rounded-2xl border border-amber-400/40 bg-amber-950/30 p-4"><p className="font-bold text-amber-100">Producer review required</p><p className="mt-1 text-sm text-amber-50/90">{draft.originalityNotes}</p><ul className="mt-3 space-y-1 text-sm text-amber-50/90">{draft.producerReviewNotes.map((note) => <li key={note}>- {note}</li>)}</ul></article>
      {!savedDraft && <button className="button-primary" type="button" onClick={saveDraft} disabled={busy !== null}>{busy === "save" ? "Saving editable draft..." : "Save and open editor"}</button>}
    </section>}
  </div>;
}
