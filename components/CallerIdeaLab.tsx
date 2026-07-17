"use client";

import { useRef, useState } from "react";
import { ChevronDown, Mic, MicOff, RotateCcw } from "lucide-react";
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
  const [callType, setCallType] = useState("auto");
  const [tone, setTone] = useState("auto");
  const [premises, setPremises] = useState<CallerPremise[]>([]);
  const [selectedPremise, setSelectedPremise] = useState<CallerPremise | null>(null);
  const [draft, setDraft] = useState<GeneratedCallerDraft | null>(null);
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);
  const [dictationDenied, setDictationDenied] = useState(false);
  const [showOptions, setShowOptions] = useState(true);
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
    recognition.onerror = (event) => {
      const denied = event.error === "not-allowed";
      setDictationDenied(denied);
      setError(denied ? "Microphone permission was not granted for dictation." : "Dictation stopped before a usable note was captured.");
    };
    recognition.onend = () => { setDictating(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setError(null);
    setDictationDenied(false);
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
      const result = await postJson<{ premises: CallerPremise[] }>("/api/caller-workshop/premises", { sourceNotes, callType, tone });
      setPremises(result.premises);
      setSelectedPremise(result.premises[0] ?? null);
      setShowOptions(true);
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
      const result = await postJson<{ draft: GeneratedCallerDraft }>("/api/caller-workshop/develop", { sourceNotes, callType, tone, premise: selectedPremise });
      setDraft(result.draft);
      setShowOptions(false);
      setNotice(`${result.draft.firstName}'s editable caller card is ready.`);
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
      const result = await postJson<{ draft: GeneratedCallerDraft }>("/api/caller-workshop/develop", { sourceNotes, callType, tone, premise });
      setDraft(result.draft);
      setShowOptions(false);
      setNotice(`${result.draft.firstName}'s editable caller card is ready.`);
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
      const result = await postJson<{ callerId: string; editUrl?: string }>("/api/caller-workshop/save", { sourceNotes, callType, tone, premise: selectedPremise, draft });
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
      <p className="eyebrow">Quick caller builder</p>
      <h2 className="mt-1 text-xl font-bold text-white">Describe the spark. The workshop does the structuring.</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">A sentence is enough. Add a preference only when it matters; otherwise the pack deliberately mixes practical, personal, opinion-led and stranger directions.</p>
      <div className="mt-5 flex items-end justify-between gap-3"><span className="label">Seed / source notes</span><button className="button-secondary !min-h-8 !px-3 text-xs" type="button" onClick={toggleDictation}>{dictating ? <><MicOff className="h-3.5 w-3.5" /> Stop dictation</> : <><Mic className="h-3.5 w-3.5" /> Dictate seed</>}</button></div><textarea className="field mt-1 min-h-36" value={sourceNotes} onChange={(event) => { setSourceNotes(event.target.value); setPremises([]); setSelectedPremise(null); setDraft(null); setSavedDraft(null); setNotice(null); setShowOptions(true); }} placeholder="For example: a caller believes a neighbourhood book-swap shelf is enforcing a bizarre hierarchy, but they have been quietly replacing the books they dislike." />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label><span className="label">Kind of call <span className="normal-case tracking-normal text-slate-500">(optional)</span></span><select className="field" value={callType} onChange={(event) => setCallType(event.target.value)}><option value="auto">Surprise me with a mix</option><option value="advice">Advice</option><option value="opinion">Opinion or dispute</option><option value="personal">Personal story</option><option value="practical">Practical problem</option><option value="wildcard">Wildcard</option></select></label>
        <label><span className="label">Tone <span className="normal-case tracking-normal text-slate-500">(optional)</span></span><select className="field" value={tone} onChange={(event) => setTone(event.target.value)}><option value="auto">Let the idea decide</option><option value="grounded">Grounded</option><option value="lively">Lively</option><option value="reflective">Reflective</option><option value="strange">Strange</option></select></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs"><button className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-cyan-300 hover:text-cyan-100" type="button" onClick={() => setSourceNotes("I accepted a promotion over a close friend and now I am not sure whether I am guilty, proud, or both.")}>Work dilemma</button><button className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-cyan-300 hover:text-cyan-100" type="button" onClick={() => setSourceNotes("Were bees just lazy bums before pollination was invented?")}>Strange question</button><button className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-cyan-300 hover:text-cyan-100" type="button" onClick={() => setSourceNotes("I keep using my old housemate's Netflix profile because deleting it would mean admitting the friendship is over.")}>Personal story</button></div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button className="button-primary" type="button" onClick={generatePremises} disabled={busy !== null || sourceNotes.trim().length < 12}>{busy === "premises" ? "Finding distinct callers..." : "Create six caller options"}</button><span className="text-xs text-slate-500">Nothing is saved until you choose a caller.</span></div>
    </section>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/40 bg-rose-950/35 px-4 py-3 text-sm text-rose-100"><div><p>{error}</p>{dictationDenied && <p className="mt-1 text-xs text-rose-100/70">If it remains blocked, use the site controls beside the address bar to allow Microphone, then try again.</p>}</div>{dictationDenied && <button className="button-secondary !min-h-8 !px-3 text-xs" type="button" onClick={toggleDictation}><RotateCcw className="h-3.5 w-3.5" /> Try microphone again</button>}</div>}
    {notice && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50"><span>{notice} Review the caller card and save it when ready.</span><a className="button-secondary !min-h-8 !px-3 text-xs" href="#caller-draft">Review caller card <ChevronDown className="h-3.5 w-3.5" /></a></div>}

    {premises.length > 0 && draft && !showOptions && <section className="panel panel-pad flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">Chosen direction</p><p className="mt-1 font-bold text-white">{selectedPremise?.title}</p><p className="mt-1 text-sm text-slate-400">The six-option pack is tucked away while you work on this caller.</p></div><button className="button-secondary" type="button" onClick={() => setShowOptions(true)}>Compare the six options</button></section>}

    {premises.length > 0 && (!draft || showOptions) && <section className="space-y-4">
      <div><p className="eyebrow">Choose a direction</p><h2 className="mt-1 text-xl font-bold text-white">Pick an option, then build its caller card</h2><p className="mt-1 text-sm text-slate-400">The cards start compact so you can scan the pack quickly. Open producer detail only when you need the deeper shape.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">{premises.map((premise, index) => {
        const isSelected = selectedPremise?.title === premise.title;
        return <article key={`${premise.title}-${index}`} className={`panel panel-pad border ${isSelected ? "border-cyan-300" : "border-slate-700/70"}`}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Option {index + 1}</p><h3 className="mt-1 text-lg font-bold text-white">{premise.title}</h3></div><button className={isSelected ? "button-primary" : "button-secondary"} type="button" onClick={() => { setSelectedPremise(premise); setDraft(null); setSavedDraft(null); }}>{isSelected ? "Selected" : "Select"}</button></div>
          <p className="mt-3 text-sm text-slate-200">{premise.setup}</p>
          <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold text-cyan-200">{premise.callMode}</span></div>
          <p className="mt-3 text-sm text-cyan-100"><b>Caller view:</b> {premise.callerPointOfView}</p>
          <p className="mt-2 text-sm text-slate-400"><b className="text-slate-300">Why it matters:</b> {premise.emotionalStake}</p>
          <details className="mt-3 rounded-lg bg-slate-950/60 p-3 text-sm"><summary className="cursor-pointer font-bold text-slate-300">Optional producer detail</summary><dl className="mt-3 grid gap-3"><div><dt className="label">Internal tension</dt><dd className="mt-1 text-slate-300">{premise.internalTension}</dd></div><div><dt className="label">Host route</dt><dd className="mt-1 text-slate-300">{premise.hostRoute}</dd></div><div><dt className="label">Originality check</dt><dd className="mt-1 text-amber-200">{premise.originalityNote}</dd></div></dl></details>
          <button className="button-primary mt-4 w-full" type="button" onClick={() => void developPremise(premise)} disabled={busy !== null}>{busy === "develop" && isSelected ? "Building caller…" : draft && isSelected ? "Rebuild this caller" : "Build this caller"}</button>
        </article>;
      })}</div>
      <div className="panel panel-pad flex flex-wrap items-center justify-between gap-4"><div><p className="font-bold text-white">{selectedPremise ? selectedPremise.title : "Select an option"}</p><p className="mt-1 text-sm text-slate-400">Select a direction, then build its editable caller card.</p></div><button className="button-secondary" type="button" onClick={developSelectedPremise} disabled={!selectedPremise || busy !== null}>{busy === "develop" ? "Building caller..." : draft ? "Rebuild selected caller" : "Build selected caller"}</button></div>
    </section>}

    {draft && <section id="caller-draft" className="space-y-4">
      <div><p className="eyebrow">Ready-to-use caller</p><h2 className="mt-1 text-xl font-bold text-white">{draft.firstName} {draft.surnameInitial} - {draft.issueHeadline}</h2><p className="mt-2 max-w-3xl text-sm text-slate-300">The workshop has filled in the production detail. Save it as-is, or fine-tune the optional notes later.</p></div>
      {savedDraft ? <div className="rounded-2xl border border-emerald-300/50 bg-emerald-400/10 p-4 text-sm text-emerald-50"><p className="font-bold">Draft saved.</p><p className="mt-1">Opening the normal caller editor now. If it does not open, <a className="font-bold underline" href={savedDraft.editUrl}>open the editable draft</a>.</p></div> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/40 bg-cyan-400/10 p-4"><p className="text-sm text-cyan-50"><b>Next:</b> save this candidate to create its editable caller draft. Nothing is approved or queued by this step.</p><button className="button-primary" type="button" onClick={saveDraft} disabled={busy !== null}>{busy === "save" ? "Saving editable draft..." : "Save and open editor"}</button></div>}
      <article className="panel panel-pad"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Caller card</p><p className="mt-1 text-lg font-bold text-white">{draft.firstName} {draft.surnameInitial}</p><p className="mt-1 text-sm text-slate-400">{draft.age} · {draft.location} · {draft.occupation}</p></div><div className="flex flex-wrap gap-2"><span className="status bg-cyan-400/10 text-cyan-200">{draft.callMode}</span><span className="status bg-slate-800 text-slate-300">{draft.emotionalTemperature} energy</span></div></div><p className="mt-5 text-base font-bold text-white">{draft.issueHeadline}</p><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{draft.openingSummary}</p><div className="mt-5 grid gap-4 border-t border-slate-700/70 pt-4 md:grid-cols-3"><div><p className="label">What they want</p><p className="mt-1 text-sm text-slate-200">{draft.desiredOutcome}</p></div><div><p className="label">Why it matters</p><p className="mt-1 text-sm text-slate-200">{draft.emotionalStake}</p></div><div><p className="label">How they sound</p><p className="mt-1 text-sm text-slate-200">{draft.speechStyle}</p></div></div></article>
      <details className="panel panel-pad"><summary className="cursor-pointer font-bold text-slate-200">Fine-tune the generated notes <span className="ml-2 text-sm font-normal text-slate-500">optional</span></summary><div className="mt-4 grid gap-4 text-sm md:grid-cols-2"><div><p className="label">Self-story</p><p className="mt-1 text-slate-300">{draft.selfStory}</p></div><div><p className="label">Behaviour</p><p className="mt-1 text-slate-300">{draft.behaviour}</p></div><div><p className="label">Internal tension</p><p className="mt-1 text-slate-300">{draft.internalTension}</p></div>{draft.withheldDetail && <div><p className="label">Optional withheld detail</p><p className="mt-1 text-slate-300">{draft.withheldDetail}</p></div>}<div><p className="label">Conversation routes</p>{draft.developmentBeats.length ? <ul className="mt-2 space-y-1 text-slate-300">{draft.developmentBeats.map((beat) => <li key={beat}>- {beat}</li>)}</ul> : <p className="mt-1 text-slate-500">No fixed beats; let the call develop naturally.</p>}</div><div><p className="label">Host questions</p><ul className="mt-2 space-y-1 text-slate-300">{draft.suggestedQuestions.map((question) => <li key={question}>- {question}</li>)}</ul></div></div></details>
      <details className="rounded-2xl border border-amber-400/40 bg-amber-950/30 p-4"><summary className="cursor-pointer font-bold text-amber-100">Optional producer review notes</summary><p className="mt-3 text-sm text-amber-50/90">{draft.originalityNotes}</p><ul className="mt-3 space-y-1 text-sm text-amber-50/90">{draft.producerReviewNotes.map((note) => <li key={note}>- {note}</li>)}</ul></details>
      {!savedDraft && <button className="button-primary" type="button" onClick={saveDraft} disabled={busy !== null}>{busy === "save" ? "Saving editable draft..." : "Save and open editor"}</button>}
    </section>}
  </div>;
}
