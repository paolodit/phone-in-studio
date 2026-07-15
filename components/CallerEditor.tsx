"use client";

import { useState } from "react";
import { Image as ImageIcon, Pencil, Save, X } from "lucide-react";
import { CallerAvatarPicker } from "@/components/CallerAvatarPicker";
import { CallerImageGenerator } from "@/components/CallerImageGenerator";

type CallerValues = {
  firstName?: string; surnameInitial?: string | null; age?: number | null; location?: string; occupation?: string | null; relationshipStatus?: string | null;
  issueHeadline?: string; openingSummary?: string; character?: unknown; story?: unknown; performance?: unknown; hostSupport?: unknown; generation?: unknown;
  assets?: { type: string; url: string }[];
};

const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const lines = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join("\n") : "";

export function CallerEditor({ action, caller, submitLabel }: {
  action: (formData: FormData) => void | Promise<void>;
  caller?: CallerValues;
  submitLabel: string;
}) {
  const character = object(caller?.character);
  const story = object(caller?.story);
  const performance = object(caller?.performance);
  const hostSupport = object(caller?.hostSupport);
  const generation = object(caller?.generation);
  const portrait = caller?.assets?.find((asset) => asset.type === "PORTRAIT")?.url ?? "";
  const [portraitUrl, setPortraitUrl] = useState(portrait);
  const [editing, setEditing] = useState(!caller);
  const selectedVoice = ({ "mock-warm-welsh": "coral", "mock-dry-welsh": "cedar", "mock-confident-welsh": "shimmer", "mock-gravel-welsh": "echo", "mock-keen-welsh": "ash" } as Record<string, string>)[string(performance.voiceId)] ?? string(performance.voiceId, "coral");
  const elevenLabsVoiceId = string(performance.elevenLabsVoiceId);
  const imagePrompt = `${caller?.firstName ?? "A fictional adult caller"}, ${caller?.location ?? "a local radio studio"}. ${caller?.issueHeadline ?? "A strange everyday complaint"}`;

  if (caller && !editing) return <section className="panel panel-pad">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="flex min-w-0 items-start gap-4">
        {portrait ? <img className="h-20 w-20 shrink-0 rounded-xl object-cover" src={portrait} alt="" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-slate-800 text-2xl font-black text-cyan-200">{caller.firstName?.slice(0, 1)}</div>}
        <div className="min-w-0"><p className="eyebrow">Caller card</p><h2 className="mt-1 text-2xl font-black text-white">{caller.firstName} {caller.surnameInitial}</h2><p className="mt-1 text-sm text-slate-300">{caller.age ? `${caller.age} · ` : ""}{caller.location}{caller.occupation ? ` · ${caller.occupation}` : ""}</p>{caller.relationshipStatus && <p className="mt-1 text-xs text-slate-500">{caller.relationshipStatus}</p>}</div>
      </div>
      <button className="button-secondary" type="button" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit caller</button>
    </div>
    <div className="mt-5 border-t border-slate-700/70 pt-5"><p className="text-lg font-bold text-white">{caller.issueHeadline}</p><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{caller.openingSummary}</p></div>
    <div className="mt-4 flex flex-wrap gap-2 text-xs">{Array.isArray(generation.topicTags) && generation.topicTags.filter((tag): tag is string => typeof tag === "string").map((tag) => <span key={tag} className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">{tag}</span>)}</div>
    <details className="mt-5 rounded-xl border border-slate-700/70 bg-slate-950/35 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-300">View private caller notes</summary><dl className="mt-4 grid gap-4 text-sm md:grid-cols-2"><div><dt className="label">Central want</dt><dd className="mt-1 text-slate-300">{string(character.centralWant, "Not set")}</dd></div><div><dt className="label">Story tension</dt><dd className="mt-1 text-slate-300">{string(character.comicContradiction, "Not set")}</dd></div><div><dt className="label">Speech style</dt><dd className="mt-1 text-slate-300">{string(character.speechStyle, "Not set")}</dd></div><div><dt className="label">Hidden truth</dt><dd className="mt-1 text-slate-300">{string(story.hiddenTruth, "Not set")}</dd></div></dl></details>
  </section>;

  return <form action={action} className="space-y-6">
    <section className="panel panel-pad">
      <h2 className="font-bold text-white">Public identity</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label><span className="label">First name</span><input className="field" name="firstName" defaultValue={caller?.firstName} required /></label>
        <label><span className="label">Surname initial</span><input className="field" name="surnameInitial" defaultValue={caller?.surnameInitial ?? ""} placeholder="M" /></label>
        <label><span className="label">Age</span><input className="field" name="age" type="number" min="18" max="120" defaultValue={caller?.age ?? ""} /></label>
        <label><span className="label">Location</span><input className="field" name="location" defaultValue={caller?.location} required /></label>
        <label><span className="label">Occupation / identity</span><input className="field" name="occupation" defaultValue={caller?.occupation ?? ""} /></label>
        <label><span className="label">Relationship status</span><input className="field" name="relationshipStatus" defaultValue={caller?.relationshipStatus ?? ""} /></label>
      </div>
    </section>

    <section className="panel panel-pad">
      <h2 className="font-bold text-white">Public premise and caller graphic</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label><span className="label">Issue headline</span><input className="field" name="issueHeadline" defaultValue={caller?.issueHeadline} required /></label>
        <label><span className="label">Topic tags</span><input className="field" name="topicTags" defaultValue={Array.isArray(generation.topicTags) ? generation.topicTags.filter((tag): tag is string => typeof tag === "string").join(", ") : ""} placeholder="local life, technology, family" /><span className="mt-1 block text-xs text-slate-500">Optional. Used to organise the caller library and suggest visuals.</span></label>
        <label className="md:col-span-2"><span className="label">Opening summary</span><textarea className="field min-h-24" name="openingSummary" defaultValue={caller?.openingSummary} required /></label>
        <details className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 md:col-span-2" open={!caller}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-200"><span className="inline-flex items-center gap-2"><ImageIcon className="h-4 w-4 text-cyan-300" /> Choose or generate caller graphic <span className="font-normal text-slate-500">(optional)</span></span></summary>
          <div className="mt-4 space-y-3">
            {portraitUrl && <div className="flex items-center gap-3 rounded-xl border border-slate-700/70 bg-slate-900/70 p-3"><img className="h-16 w-16 rounded-lg object-cover" src={portraitUrl} alt="Current caller portrait" /><div><p className="text-sm font-bold text-white">Current portrait</p><p className="mt-1 text-xs text-slate-400">Choose another option below or keep this one.</p></div></div>}
            <details className="rounded-xl border border-slate-700/70 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200">Avatar library</summary><div className="mt-3"><CallerAvatarPicker defaultSeed={`${caller?.firstName ?? "new"}-${caller?.location ?? "caller"}`} onUseAsPortrait={setPortraitUrl} /></div></details>
            <details className="rounded-xl border border-slate-700/70 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200">Generate an original portrait</summary><div className="mt-3"><CallerImageGenerator defaultPrompt={imagePrompt} onUseAsPortrait={setPortraitUrl} /></div></details>
            <details className="rounded-xl border border-slate-700/70 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200">Use a custom image URL</summary><label className="mt-3 block"><span className="label">Image URL</span><input className="field" name="portraitUrl" type="url" value={portraitUrl} onChange={(event) => setPortraitUrl(event.target.value)} placeholder="https://…" /><span className="mt-1 block text-xs text-slate-500">Only use an image you have the right to display.</span></label></details>
          </div>
        </details>
      </div>
    </section>

    <details className="panel panel-pad" open={!caller}>
      <summary className="cursor-pointer font-bold text-white">Private caller card <span className="ml-2 text-sm font-normal text-slate-400">{caller ? "Optional detail and performance controls" : "Required for a manual caller"}</span></summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label><span className="label">Central want</span><textarea className="field min-h-20" name="centralWant" defaultValue={string(character.centralWant)} required /></label>
        <label><span className="label">Worldview</span><textarea className="field min-h-20" name="worldview" defaultValue={string(character.worldview)} required /></label>
        <label><span className="label">Actual behaviour</span><textarea className="field min-h-20" name="actualBehaviour" defaultValue={string(character.actualBehaviour)} required /></label>
        <label><span className="label">Story tension / pressure point</span><textarea className="field min-h-20" name="comicContradiction" defaultValue={string(character.comicContradiction)} required /></label>
        <label><span className="label">Speech style</span><textarea className="field min-h-20" name="speechStyle" defaultValue={string(character.speechStyle)} required /></label>
        <label><span className="label">Selected voice</span><select className="field" name="voiceId" defaultValue={selectedVoice} required><option value="alloy">Alloy — neutral</option><option value="ash">Ash — lively</option><option value="ballad">Ballad — rounded</option><option value="coral">Coral — warm</option><option value="cedar">Cedar — dry</option><option value="echo">Echo — low-key</option><option value="marin">Marin — balanced</option><option value="sage">Sage — composed</option><option value="shimmer">Shimmer — bright</option><option value="verse">Verse — expressive</option></select></label>
        <label><span className="label">Delivery pace</span><select className="field" name="pacing" defaultValue={string(performance.pacing, "Conversational")}><option>Measured</option><option>Conversational</option><option>Brisk</option><option>Animated</option></select></label>
        <label><span className="label">ElevenLabs voice ID (optional)</span><input className="field" name="elevenLabsVoiceId" defaultValue={elevenLabsVoiceId} placeholder="Uses the Agent default when blank" /><span className="mt-1 block text-xs text-slate-500">Used only for the ElevenLabs Agent route.</span></label>
        <label className="md:col-span-2"><span className="label">Hidden truth</span><textarea className="field min-h-20" name="hiddenTruth" defaultValue={string(story.hiddenTruth)} required /></label>
        <label><span className="label">Escalation beats (one per line)</span><textarea className="field min-h-28" name="escalationBeats" defaultValue={lines(story.escalationBeats)} required /></label>
        <label><span className="label">Suggested host questions (one per line)</span><textarea className="field min-h-28" name="suggestedQuestions" defaultValue={lines(hostSupport.suggestedQuestions)} required /></label>
      </div>
    </details>
    <div className="sticky bottom-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/30 bg-slate-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur"><p className="text-xs text-slate-400">Changes are not live until you save.</p><div className="flex gap-2">{caller && <button className="button-secondary" type="button" onClick={() => setEditing(false)}><X className="h-4 w-4" /> Cancel</button>}<button className="button-primary" type="submit"><Save className="h-4 w-4" /> {submitLabel}</button></div></div>
  </form>;
}
