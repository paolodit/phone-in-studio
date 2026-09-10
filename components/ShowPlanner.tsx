"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Clock3, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { planTiming, type PlanContent, type ShowPlanView } from "@/lib/show-plan";

type Slot = PlanContent["slots"][number];
function CardEditor({ slot, busy, save, cancel }: { slot: Slot; busy: boolean; save: (slot: Slot) => void; cancel: () => void }) {
  return <form className="mt-4 space-y-3" onSubmit={(event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    save({ ...slot, minutes: Number(data.get("minutes")), reasonTonight: String(data.get("reasonTonight")), draft: { ...slot.draft, issueHeadline: String(data.get("headline")), openingSummary: String(data.get("summary")), desiredOutcome: String(data.get("want")) } });
  }}><fieldset disabled={busy} className="space-y-3">
    <label className="block"><span className="label">On-air headline</span><input className="field" name="headline" defaultValue={slot.draft.issueHeadline} minLength={5} maxLength={180} required /></label>
    <label className="block"><span className="label">Opening situation</span><textarea className="field" name="summary" defaultValue={slot.draft.openingSummary} minLength={10} maxLength={1000} rows={3} required /></label>
    <label className="block"><span className="label">Why tonight?</span><textarea className="field" name="reasonTonight" defaultValue={slot.reasonTonight} minLength={5} maxLength={400} rows={2} required /></label>
    <div className="grid gap-3 sm:grid-cols-[1fr_120px]"><label><span className="label">What they want from you</span><input className="field" name="want" defaultValue={slot.draft.desiredOutcome} minLength={3} maxLength={500} required /></label><label><span className="label">Minutes</span><input type="number" className="field" name="minutes" min={1} max={30} defaultValue={slot.minutes} required /></label></div>
    <div className="flex gap-2"><button className="button-primary" type="submit">Save card</button><button className="button-secondary" type="button" onClick={cancel}>Cancel</button></div>
  </fieldset></form>;
}

export function ShowPlanner({ initialPlan, recent }: { initialPlan: ShowPlanView | null; recent: { id: string; title: string }[] }) {
  const [plan, setPlan] = useState(initialPlan);
  const [brief, setBrief] = useState("");
  const [duration, setDuration] = useState(20);
  const [count, setCount] = useState(4);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [briefReady, setBriefReady] = useState(false);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem("phone-in:show-brief") ?? "null"); if (saved) { setBrief(String(saved.brief ?? "")); setDuration([15, 20, 30, 45, 60].includes(saved.duration) ? saved.duration : 20); setCount(saved.count === 6 ? 6 : 4); } } catch { /* unavailable browser storage must not block planning */ }
    setBriefReady(true);
  }, []);
  useEffect(() => { if (briefReady) { try { localStorage.setItem("phone-in:show-brief", JSON.stringify({ brief, duration, count })); } catch { /* server plans remain saved */ } } }, [brief, duration, count, briefReady]);
  useEffect(() => {
    if (!busy && !editing) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [busy, editing]);

  async function request(path: string, body: unknown) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error ?? "The request could not finish. Your saved plan is still available.");
    return data;
  }
  const generate = async () => {
    setBusy("draft"); setError(false); setMessage("Drafting a varied line-up and complete caller cards. This may take a minute or two…");
    try { const next = await request("/api/show-plans", { brief, durationMinutes: duration, count }); setPlan(next); window.history.replaceState(null, "", `/shows/plan?plan=${next.id}`); setMessage("Draft saved. Review the callers below; nothing is in your library or on air yet."); }
    catch (cause) { setError(true); setMessage((cause as Error).message); } finally { setBusy(""); }
  };
  const command = async (action: "save" | "swap" | "approve", extra: { content?: PlanContent; slotId?: string } = {}) => {
    if (!plan) return;
    setBusy(action === "swap" ? extra.slotId! : action); setError(false); setMessage(action === "swap" ? "Finding a different caller for this place in the show…" : "Saving…");
    try {
      const result = await request(`/api/show-plans/${plan.id}`, { action, revision: plan.revision, ...extra });
      if (action === "approve") { window.location.assign(`/shows/${result.showId}`); return; }
      setPlan(result); setEditing(null); setMessage("Saved. This is still a private plan.");
    } catch (cause) { setError(true); setMessage((cause as Error).message); } finally { setBusy(""); }
  };
  const changeSlot = (slot: Slot) => { if (plan) void command("save", { content: { ...plan.content, slots: plan.content.slots.map((item) => item.id === slot.id ? slot : item) } }); };
  const move = (index: number, direction: number) => {
    if (!plan) return; const slots = [...plan.content.slots]; const target = index + direction;
    if (target < 0 || target >= slots.length) return;
    [slots[index], slots[target]] = [slots[target], slots[index]]; void command("save", { content: { ...plan.content, slots } });
  };
  const timing = plan ? planTiming(plan.content, plan.durationMinutes) : null;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">From a spark to a show</p><h1 className="title mt-1">Make tonight’s show</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Give us the idea. Shape the line-up. Make it yours before anyone goes on air.</p></div><Link className="button-secondary" href="/shows">Your shows</Link></header>
    {!plan && <form className="panel panel-pad max-w-4xl" onSubmit={(event) => { event.preventDefault(); void generate(); }}><fieldset disabled={!!busy} className="space-y-5">
      <label className="block"><span className="label">What are we talking about tonight?</span><textarea className="field mt-3 min-h-36 text-base leading-7" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="A late-night phone-in about starting over. Some warmth, some awkwardness, one genuinely strange caller." minLength={15} maxLength={3000} required /></label>
      <div className="flex flex-wrap gap-2">{["Starting over, late at night. Warm, awkward, and one wonderfully strange caller.", "The tiny rules people live by. A mix of practical dilemmas, disagreements and unexpected stories.", "A gentle Sunday show about friendships changing as we get older. Specific people, not generic advice."].map((seed, index) => <button className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-cyan-400" type="button" key={seed} onClick={() => setBrief(seed)}>{["Starting over", "Unwritten rules", "Changing friendships"][index]}</button>)}</div>
      <div className="grid max-w-lg gap-4 sm:grid-cols-2"><label><span className="label">Show length</span><select className="field" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[15,20,30,45,60].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></label><label><span className="label">Caller cards</span><select className="field" value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={4}>4 · a focused line-up</option><option value={6}>6 · more variety</option></select></label></div>
      <div className="flex flex-wrap items-center gap-4"><button className="button-primary" disabled={!briefReady || !!busy}><Sparkles className="h-4 w-4" />{busy ? "Drafting your show…" : "Draft my line-up"}</button><span className="text-xs text-slate-400">Uses your configured OpenAI key. A private draft, not bulk caller creation.</span></div>
    </fieldset></form>}
    {message && <p role={error ? "alert" : "status"} className={`rounded-xl border p-4 text-sm ${error ? "border-rose-400/30 bg-rose-950/30 text-rose-100" : "border-cyan-300/20 bg-cyan-950/30 text-cyan-100"}`}>{message}{error && plan && <a href={`/shows/plan?plan=${plan.id}`} className="ml-3 underline">Reload saved plan</a>}</p>}
    {plan && <>
      <section className="panel panel-pad">
        <div className="flex flex-wrap justify-between gap-4"><div className="max-w-3xl"><p className="eyebrow">Your proposed line-up · saved draft</p><h2 className="mt-2 text-2xl font-bold text-white">{plan.content.title}</h2><p className="mt-3 text-sm leading-6 text-slate-300">{plan.content.synopsis}</p></div><span className="flex h-fit items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-sm text-slate-200"><Clock3 className="h-4 w-4" />{plan.durationMinutes} min</span></div>
        {editing === "show" ? <form className="mt-5 max-w-3xl" onSubmit={(event) => {
          event.preventDefault(); const data = new FormData(event.currentTarget);
          void command("save", { content: { ...plan.content, title: String(data.get("title")), synopsis: String(data.get("synopsis")) } });
        }}><fieldset disabled={!!busy} className="space-y-3"><label className="block"><span className="label">Show title</span><input name="title" className="field" defaultValue={plan.content.title} minLength={3} maxLength={120} required /></label><label className="block"><span className="label">The shape of the show</span><textarea name="synopsis" className="field" defaultValue={plan.content.synopsis} rows={3} minLength={5} maxLength={700} required /></label><div className="flex gap-2"><button className="button-primary">Save show details</button><button type="button" className="button-secondary" onClick={() => setEditing(null)}>Cancel</button></div></fieldset></form> : !plan.acceptedShowId && <button className="mt-4 inline-flex items-center gap-2 text-sm text-cyan-200" disabled={!!busy || !!editing} onClick={() => setEditing("show")}><Pencil className="h-3 w-3" />Edit title & outline</button>}
        <details className="mt-4 text-xs text-slate-400"><summary className="cursor-pointer">Original brief</summary><p className="mt-2 whitespace-pre-wrap">{plan.brief}</p></details>
      </section>
      {plan.acceptedShowId ? <div className="panel panel-pad"><p>This plan has already become a show.</p><Link href={`/shows/${plan.acceptedShowId}`} className="button-primary mt-3">Open show workspace</Link></div> : <>
        <div className="grid gap-4 lg:grid-cols-2">{plan.content.slots.map((slot, index) => <article key={slot.id} className={`panel panel-pad ${!slot.keep ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between gap-3"><p className="eyebrow">{index + 1} / {slot.role}</p><span className="text-xs text-slate-400">~{slot.minutes} min</span></div>
          <h3 className="mt-3 text-xl font-bold text-white">{slot.draft.firstName} {slot.draft.surnameInitial}<span className="ml-2 text-xs font-normal text-slate-400">{slot.draft.location}</span></h3><p className="mt-3 font-semibold leading-6 text-slate-100">{slot.draft.issueHeadline}</p><p className="mt-3 text-sm leading-6 text-slate-400">{slot.reasonTonight}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-cyan-100"><span className="rounded-full bg-cyan-950/60 px-2.5 py-1">{slot.draft.callMode}</span><span className="rounded-full bg-slate-800 px-2.5 py-1">{slot.draft.emotionalTemperature} intensity</span></div>
          <details className="mt-4 text-sm"><summary className="cursor-pointer text-slate-300">Read caller & visual idea</summary><div className="mt-3 space-y-3 text-sm leading-6 text-slate-400"><p>{slot.draft.openingSummary}</p><p><b className="text-slate-200">Wants:</b> {slot.draft.desiredOutcome}</p><p><b className="text-slate-200">Tension:</b> {slot.draft.internalTension}</p><p><b className="text-slate-200">Voice:</b> {slot.draft.voiceId} · {slot.draft.speechStyle}</p><p><b className="text-slate-200">Visual suggestion:</b> {slot.visualIdea} (not fetched yet)</p>{slot.draft.suggestedQuestions.map((question) => <p key={question}>“{question}”</p>)}</div></details>
          {editing === slot.id ? <CardEditor key={slot.id} slot={slot} busy={!!busy} save={changeSlot} cancel={() => setEditing(null)} /> : <div className="mt-5 flex flex-wrap gap-2">
            <button className={slot.keep ? "button-primary" : "button-secondary"} aria-pressed={slot.keep} disabled={!!busy || !!editing} onClick={() => changeSlot({ ...slot, keep: !slot.keep })}><Check className="h-4 w-4" />{slot.keep ? "Keeping" : "Keep caller"}</button>
            <button className="button-secondary" disabled={!!busy || !!editing} onClick={() => setEditing(slot.id)}><Pencil className="h-4 w-4" />Tweak</button>
            <button className="button-secondary" disabled={!!busy || !!editing} onClick={() => void command("swap", { slotId: slot.id })}><RefreshCw className={`h-4 w-4 ${busy === slot.id ? "animate-spin" : ""}`} />Swap</button>
            <button className="button-secondary px-2" aria-label={`Move ${slot.draft.firstName} earlier`} disabled={!!busy || !!editing || index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></button><button className="button-secondary px-2" aria-label={`Move ${slot.draft.firstName} later`} disabled={!!busy || !!editing || index === plan.content.slots.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></button>
          </div>}
        </article>)}</div>
        <section className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-300/30 bg-[#0c1929]/95 p-5 shadow-xl backdrop-blur"><div><p className="font-bold text-white">{timing!.count} callers · about {timing!.callerMinutes} minutes</p><p className={`mt-1 text-xs ${timing!.remainingMinutes < 0 ? "text-rose-300" : "text-slate-400"}`}>{timing!.remainingMinutes < 0 ? "Over the planned length. Tweak the timings." : `${timing!.remainingMinutes} minutes left for your opening, transitions and close.`}</p><p className="mt-2 max-w-2xl text-xs text-slate-400">Approval adds only kept callers to your library and creates a new, ready show. It does not start broadcasting.</p></div><button className="button-primary" disabled={!!busy || !!editing || !timing!.count || timing!.remainingMinutes < 0} onClick={() => void command("approve")}>{busy === "approve" ? "Creating your show…" : "Approve selected & create show"}</button></section>
      </>}
      <a href="/shows/plan" className="inline-block text-sm text-slate-400 underline">Start a different brief</a>
    </>}
    {!plan && recent.length > 0 && <section><h2 className="text-sm font-bold text-slate-300">Pick up a saved plan</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{recent.map((item) => <Link key={item.id} href={`/shows/plan?plan=${item.id}`} className="panel panel-pad text-sm hover:border-cyan-300/40">{item.title} <span className="float-right text-cyan-300">Continue →</span></Link>)}</div></section>}
  </div>;
}
