"use client";

import { useRef, useState } from "react";
import type { CallerPremise, GeneratedCallerDraft } from "@/lib/schemas";

type BusyAction = "premises" | "develop" | "save" | null;
type SavedDraft = { callerId: string; editUrl: string };
type Dictation = { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null };
type DictationWindow = Window & typeof globalThis & { SpeechRecognition?: new () => Dictation; webkitSpeechRecognition?: new () => Dictation };

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
  const [notice, setNotice] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);
  const recognitionRef = useRef<Dictation | null>(null);

  function toggleDictation() {
    if (dictating) { recognitionRef.current?.stop(); return; }
    const Constructor = (window as DictationWindow).SpeechRecognition ?? (window as DictationWindow).webkitSpeechRecognition;
    if (!Constructor) { setError("Voice dictation needs Chrome or Edge. You can still type or paste the seed."); return; }
    const recognition = new Constructor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
      const spoken = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (spoken) setSourceNotes((current) => [current.trim(), spoken].filter(Boolean).join(current.trim() ? " " : ""));
    };
    recognition.onerror = (event) => { setError(event.error === "not-allowed" ? "Microphone permission was not granted for dictation." : "Dictation stopped before a usable note was captured."); };
    recognition.onend = () => { setDictating(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setError(null);
    setDictating(true);
    recognition.start();
  }

  async function generatePremises() {
    setBusy("premises");
    setError(null);
    setDraft(null);
    setSavedDraft(null);
    setNotice(null);
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
      setNotice(`${result.draft.firstName}'s editable caller card is ready below. Review it, then save when you are happy.`);
      window.setTimeout(() => document.getElementById("caller-draft")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to develop this caller.");
    } finally {
      setBusy(null);
    }
  }

  async function developPremise(premise: CallerPremise) {
    setSelectedPremise(premise);
    setDraft(null);
    setSavedDraft(null);
    setNotice(null);
    setBusy("develop");
    setError(null);
    try {
      const result = await postJson<{ draft: GeneratedCallerDraft }>("/api/caller-workshop/develop", { sourceNotes, premise });
      setDraft(result.draft);
      setNotice(`${result.draft.firstName}'s editable caller card is ready below. Review it, then save when you are happy.`);
      window.setTimeout(() => document.getElementById("caller-draft")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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
      <p className="eyebrow">Fast character pack</p>
      <h2 className="mt-1 text-xl font-bold text-white">Turn one seed into six ready-to-shape callers</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">Start with any show-worthy situation, view, story, prop, local texture or dilemma. The workshop creates fictional adult callers for any phone-in format; all outputs stay editable and unapproved.</p>
      <div className="mt-5 flex items-end justify-between gap-3"><span className="label">Seed / source notes</span><button className="button-secondary !min-h-8 !px-3 text-xs" type="button" onClick={toggleDictation}>{dictating ? "Stop dictation" : "🎙 Dictate seed"}</button></div><textarea className="field mt-1 min-h-36" value={sourceNotes} onChange={(event) => { setSourceNotes(event.target.value); setPremises([]); setSelectedPremise(null); setDraft(null); setSavedDraft(null); setNotice(null); }} placeholder="For example: a caller believes a neighbourhood book-swap shelf is enforcing a bizarre hierarchy, but they have been quietly replacing the books they dislike." />
      <div className="mt-3 flex flex-wrap gap-2 text-xs"><button className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-cyan-300 hover:text-cyan-100" type="button" onClick={() => setSourceNotes("A caller wants advice after their neighbours have turned the communal garden into a booking system.")}>Advice dilemma</button><button className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-cyan-300 hover:text-cyan-100" type="button" onClick={() => setSourceNotes("A supporter insists their local club should retire a number after an unforgettable non-league cup run.")}>Sports opinion</button><button className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-cyan-300 hover:text-cyan-100" type="button" onClick={() => setSourceNotes("A caller tells the host about the small decision that accidentally started a surprisingly intense family tradition.")}>Personal story</button></div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button className="button-primary" type="button" onClick={generatePremises} disabled={busy !== null || sourceNotes.trim().length < 12}>{busy === "premises" ? "Finding angles..." : "Generate six options"}</button><span className="text-xs text-slate-500">Nothing is saved until you choose Save draft.</span></div>
    </section>

    {error && <div role="alert" className="rounded-xl border border-red-400/50 bg-red-950/50 px-4 py-3 text-sm text-red-100">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">{notice}</div>}

    {premises.length > 0 && <section className="space-y-4">
      <div><p className="eyebrow">Choose a direction</p><h2 className="mt-1 text-xl font-bold text-white">Pick an option, then build its caller card</h2><p className="mt-1 text-sm text-slate-400">The cards start compact so you can scan the pack quickly. Open producer detail only when you need the deeper shape.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">{premises.map((premise, index) => {
        const isSelected = selectedPremise?.title === premise.title;
        return <article key={`${premise.title}-${index}`} className={`panel panel-pad border ${isSelected ? "border-cyan-300" : "border-slate-700/70"}`}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Option {index + 1}</p><h3 className="mt-1 text-lg font-bold text-white">{premise.title}</h3></div><button className={isSelected ? "button-primary" : "button-secondary"} type="button" onClick={() => { setSelectedPremise(premise); setDraft(null); setSavedDraft(null); }}>{isSelected ? "Selected" : "Select"}</button></div>
          <p className="mt-3 text-sm text-slate-200">{premise.setup}</p>
          <p className="mt-3 text-sm text-cyan-100"><b>Caller view:</b> {premise.callerPointOfView}</p>
          <details className="mt-3 rounded-lg bg-slate-950/60 p-3 text-sm"><summary className="cursor-pointer font-bold text-slate-300">Producer detail</summary><dl className="mt-3 grid gap-3"><div><dt className="label">Story tension</dt><dd className="mt-1 text-slate-300">{premise.comicContradiction}</dd></div><div><dt className="label">Host route</dt><dd className="mt-1 text-slate-300">{premise.hostChallenge}</dd></div><div><dt className="label">Escalation</dt><dd className="mt-1 text-slate-300">{premise.escalationPossibility}</dd></div><div><dt className="label">Originality check</dt><dd className="mt-1 text-amber-200">{premise.originalityWarning}</dd></div></dl></details>
          <button className="button-primary mt-4 w-full" type="button" onClick={() => void developPremise(premise)} disabled={busy !== null}>{busy === "develop" && isSelected ? "Building caller…" : "Build this caller"}</button>
        </article>;
      })}</div>
      <div className="panel panel-pad flex flex-wrap items-center justify-between gap-4"><div><p className="font-bold text-white">{selectedPremise ? selectedPremise.title : "Select an option"}</p><p className="mt-1 text-sm text-slate-400">Want to compare before committing? Select an option, then build it here.</p></div><button className="button-secondary" type="button" onClick={developSelectedPremise} disabled={!selectedPremise || busy !== null}>{busy === "develop" ? "Building caller..." : "Build selected caller"}</button></div>
    </section>}

    {draft && <section id="caller-draft" className="space-y-4">
      <div><p className="eyebrow">Ready-to-edit caller</p><h2 className="mt-1 text-xl font-bold text-white">{draft.firstName} {draft.surnameInitial} - {draft.issueHeadline}</h2><p className="mt-2 max-w-3xl text-sm text-slate-300">This is a private, unapproved production draft. Save it now for an immediately usable caller card; deeper producer controls stay available in the editor when needed.</p></div>
      {savedDraft ? <div className="rounded-2xl border border-emerald-300/50 bg-emerald-400/10 p-4 text-sm text-emerald-50"><p className="font-bold">Draft saved.</p><p className="mt-1">Opening the normal caller editor now. If it does not open, <a className="font-bold underline" href={savedDraft.editUrl}>open the editable draft</a>.</p></div> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/40 bg-cyan-400/10 p-4"><p className="text-sm text-cyan-50"><b>Next:</b> save this candidate to create its editable caller draft. Nothing is approved or queued by this step.</p><button className="button-primary" type="button" onClick={saveDraft} disabled={busy !== null}>{busy === "save" ? "Saving editable draft..." : "Save and open editor"}</button></div>}
      <div className="grid gap-4 lg:grid-cols-2"><article className="panel panel-pad"><h3 className="font-bold text-white">Public caller frame</h3><dl className="mt-4 grid gap-3 text-sm"><div><dt className="label">Identity</dt><dd className="mt-1 text-slate-200">{draft.age}, {draft.location} - {draft.occupation}</dd></div><div><dt className="label">Relationship status</dt><dd className="mt-1 text-slate-200">{draft.relationshipStatus}</dd></div><div><dt className="label">Opening summary</dt><dd className="mt-1 text-slate-200">{draft.openingSummary}</dd></div><div><dt className="label">Speech style</dt><dd className="mt-1 text-slate-200">{draft.speechStyle}</dd></div></dl></article>
        <article className="panel panel-pad"><h3 className="font-bold text-white">Private caller card</h3><dl className="mt-4 grid gap-3 text-sm"><div><dt className="label">Central want</dt><dd className="mt-1 text-slate-200">{draft.centralWant}</dd></div><div><dt className="label">Actual behaviour</dt><dd className="mt-1 text-slate-200">{draft.actualBehaviour}</dd></div><div><dt className="label">Story tension</dt><dd className="mt-1 text-slate-200">{draft.comicContradiction}</dd></div><div><dt className="label">Withheld detail</dt><dd className="mt-1 text-slate-200">{draft.hiddenTruth}</dd></div></dl></article></div>
      <div className="grid gap-4 lg:grid-cols-2"><article className="panel panel-pad"><h3 className="font-bold text-white">Escalation beats</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">{draft.escalationBeats.map((beat) => <li key={beat}>{beat}</li>)}</ol></article><article className="panel panel-pad"><h3 className="font-bold text-white">Suggested host questions</h3><ul className="mt-3 space-y-2 text-sm text-slate-300">{draft.suggestedQuestions.map((question) => <li key={question}>- {question}</li>)}</ul></article></div>
      <details className="rounded-2xl border border-amber-400/40 bg-amber-950/30 p-4"><summary className="cursor-pointer font-bold text-amber-100">Optional producer review notes</summary><p className="mt-3 text-sm text-amber-50/90">{draft.originalityNotes}</p><ul className="mt-3 space-y-1 text-sm text-amber-50/90">{draft.producerReviewNotes.map((note) => <li key={note}>- {note}</li>)}</ul></details>
      {!savedDraft && <button className="button-primary" type="button" onClick={saveDraft} disabled={busy !== null}>{busy === "save" ? "Saving editable draft..." : "Save and open editor"}</button>}
    </section>}
  </div>;
}
