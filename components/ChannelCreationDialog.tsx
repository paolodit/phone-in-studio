"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bot, KeyRound, Mic2, Plus } from "lucide-react";
import { ChannelDialog } from "@/components/ChannelDialog";
import { channelCreationModes, defaultChannelCreationMode, type ChannelCreationMode, type StarterPackMenuItem } from "@/lib/channel-creation-options";

type ActionState = { error?: string };
export function ChannelCreationDialog({ action, packs, initialOpen = false, firstChannel = false }: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  packs: StarterPackMenuItem[]; initialOpen?: boolean; firstChannel?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState<"mode" | "setup">("mode");
  const [mode, setMode] = useState<ChannelCreationMode>(defaultChannelCreationMode);
  const [packId, setPackId] = useState(packs.find((pack) => pack.mode === "human")?.id ?? "");
  const [title, setTitle] = useState("");
  const [state, formAction, pending] = useActionState(action, {});
  const selected = packs.find((pack) => pack.id === packId && pack.mode === mode);
  useEffect(() => { if (initialOpen) setOpen(true); }, [initialOpen]);
  const close = () => {
    setOpen(false);
    const url = new URL(window.location.href); url.searchParams.delete("new");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const begin = () => { setMode(defaultChannelCreationMode); setPackId(packs.find((pack) => pack.mode === "human")?.id ?? ""); setStep("mode"); setOpen(true); };
  const chooseMode = (value: ChannelCreationMode) => {
    setMode(value); const pack = packs.find((item) => item.mode === value); setPackId(pack?.id ?? ""); setTitle(pack?.name ?? "");
  };
  const continueToSetup = () => { if (mode !== "custom") setTitle(selected?.name ?? ""); setStep("setup"); };
  return <>
    <button type="button" className="button-primary" onClick={begin}><Plus className="h-4 w-4" />New channel</button>
    <ChannelDialog open={open} title={firstChannel ? "Create your first channel" : "Create a channel"} busy={pending} onClose={close}>
      <p className="mt-2 text-sm leading-6 text-slate-400">A channel is your show workspace: its own Studio, guests, running order and broadcast output. Everything stays editable.</p>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-cyan-200">{step === "mode" ? "1 · How would you like to start?" : "2 · Make it yours"}</p>
      {step === "mode" ? <>
        <fieldset className="mt-4 space-y-3"><legend className="sr-only">How would you like to start?</legend>{channelCreationModes.map((option) => {
          const Icon = option.id === "custom" ? KeyRound : option.id === "human" ? Mic2 : Bot;
          return <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${mode === option.id ? "border-cyan-300 bg-cyan-300/10" : "border-slate-700 bg-slate-950/40 hover:border-slate-500"}`}>
            <input type="radio" name="creation-mode" value={option.id} checked={mode === option.id} onChange={() => chooseMode(option.id)} className="mt-1 accent-cyan-300" /><Icon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" /><span><span className="block font-bold text-white">{option.name}{option.id === "human" && <span className="ml-2 text-[10px] uppercase tracking-wide text-cyan-200">Recommended</span>}</span><span className="mt-1 block text-sm leading-6 text-slate-400">{option.description}</span></span>
          </label>;
        })}</fieldset>
        <div className="mt-5 flex justify-end"><button type="button" className="button-primary" onClick={continueToSetup}>Continue<ArrowRight className="h-4 w-4" /></button></div>
      </> : <form action={formAction} className="mt-4 space-y-5">
        <input type="hidden" name="mode" value={mode} /><input type="hidden" name="packId" value={selected?.id ?? ""} />
        <fieldset disabled={pending} className="space-y-5">
          {mode === "custom" ? <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4"><p className="font-bold text-white">Give Me the Keys</p><p className="mt-2 text-sm leading-6 text-slate-400">Name your channel, then use the existing setup to choose its format and add your own callers.</p><Link href="/shows/plan" className="mt-3 inline-block text-sm font-bold text-cyan-200">Or use “Make tonight’s show” to plan from an idea →</Link></div> : <>
            <fieldset className="space-y-3"><legend className="mb-3 font-bold text-white">{mode === "human" ? "Choose your starter pack" : "Your auto-run preset"}</legend>{packs.filter((pack) => pack.mode === mode).map((pack) => <label key={pack.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${selected?.id === pack.id ? "border-cyan-300 bg-cyan-300/10" : "border-slate-700 bg-slate-950/40"}`}><input type="radio" name="pack-choice" value={pack.id} checked={selected?.id === pack.id} onChange={() => { setPackId(pack.id); setTitle(pack.name); }} className="mt-1 accent-cyan-300" /><span><span className="block font-bold text-white">{pack.name}</span><span className="mt-1 block text-sm leading-6 text-slate-400">{pack.description}</span><span className="mt-2 block text-xs text-cyan-200">{pack.expectedGuests} independent guests{pack.mode === "auto" ? " + AI presenter" : " · You present"}</span>{pack.unavailableReason && <span className="mt-2 block text-xs text-amber-200">{pack.unavailableReason}</span>}</span></label>)}</fieldset>
            <p className="text-xs leading-6 text-slate-400">Background music and image autoplay start enabled. Prepared images use the existing stock sources when configured. Change music, volume and images in Studio.</p>
            {mode === "auto" && <p className="rounded-lg bg-violet-400/10 p-3 text-xs leading-6 text-violet-100">Choosing this preset enables the optional AI Host and creates its own presenter. Provider keys and credits are required to run voices. Nothing broadcasts until you explicitly start auto-run in Studio.</p>}
          </>}
          <label className="block"><span className="label">Channel name</span><input className="field" name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Friday night phone-in" minLength={3} maxLength={120} required /></label>
          {selected?.unavailableReason && <p role="status" className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-sm leading-6 text-amber-100">This pack will be available once its final cast is confirmed. For now, choose Give Me the Keys to create your own channel.</p>}
          {state.error && <p role="alert" className="text-sm text-rose-200">{state.error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" className="button-secondary" onClick={() => setStep("mode")}><ArrowLeft className="h-4 w-4" />Back</button><button className="button-primary" disabled={pending || (mode !== "custom" && (!selected || Boolean(selected.unavailableReason)))}>{pending ? "Preparing your channel…" : mode === "custom" ? "Create channel" : "Create channel with this pack"}</button></div>
        </fieldset>
      </form>}
    </ChannelDialog>
  </>;
}
