"use client";

import { useState } from "react";
import { Image as ImageIcon, Pencil, Save, SlidersHorizontal, UserRound, Volume2, X } from "lucide-react";
import { CallerAvatarPicker } from "@/components/CallerAvatarPicker";
import { CallerImageGenerator } from "@/components/CallerImageGenerator";
import { normalizeOpenAIVoice, normalizeVoicePresentation, OPENAI_VOICE_OPTIONS } from "@/lib/voices";

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
  const selectedVoice = normalizeOpenAIVoice(performance.voiceId ?? "marin");
  const selectedVoicePresentation = normalizeVoicePresentation(performance.voicePresentation);
  const elevenLabsVoiceId = string(performance.elevenLabsVoiceId);
  const fishAudioVoiceId = string(performance.fishAudioVoiceId);
  const imagePrompt = `${caller?.firstName ?? "A fictional adult caller"}, ${caller?.location ?? "a local radio studio"}. ${caller?.issueHeadline ?? "A distinctive everyday phone-in topic"}`;
  const tags = Array.isArray(generation.topicTags) ? generation.topicTags.filter((tag): tag is string => typeof tag === "string") : [];

  if (caller && !editing) return <section className="panel panel-pad">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="flex min-w-0 items-start gap-4">
        {portrait ? <img className="h-20 w-20 shrink-0 rounded-xl object-cover" src={portrait} alt="" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-slate-800 text-2xl font-black text-cyan-200">{caller.firstName?.slice(0, 1)}</div>}
        <div className="min-w-0"><p className="eyebrow">Caller card</p><h2 className="mt-1 text-2xl font-black text-white">{caller.firstName} {caller.surnameInitial}</h2><p className="mt-1 text-sm text-slate-300">{caller.location}{caller.occupation ? ` · ${caller.occupation}` : ""}</p></div>
      </div>
      <button className="button-secondary" type="button" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit caller</button>
    </div>
    <div className="mt-5 border-t border-slate-700/70 pt-5"><p className="text-lg font-bold text-white">{caller.issueHeadline}</p><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{caller.openingSummary}</p></div>
    {tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2 text-xs">{tags.map((tag) => <span key={tag} className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">{tag}</span>)}</div>}
    <details className="mt-5 rounded-xl border border-slate-700/70 bg-slate-950/35 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-300">Fine-tune notes</summary><dl className="mt-4 grid gap-4 text-sm md:grid-cols-2"><div><dt className="label">Desired outcome</dt><dd className="mt-1 text-slate-300">{string(character.centralWant, "Let the conversation develop naturally.")}</dd></div><div><dt className="label">Internal tension</dt><dd className="mt-1 text-slate-300">{string(character.comicContradiction, "No fixed tension.")}</dd></div><div><dt className="label">Speaking style</dt><dd className="mt-1 text-slate-300">{string(character.speechStyle, "Natural conversational speech.")}</dd></div><div><dt className="label">Withheld detail</dt><dd className="mt-1 text-slate-300">{string(story.hiddenTruth, "None — this caller can be open with the host.")}</dd></div></dl></details>
  </section>;

  return <form action={action} className="space-y-4">
    <section className="panel panel-pad">
      <div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-cyan-300" /><div><h2 className="font-bold text-white">Caller essentials</h2><p className="mt-0.5 text-xs text-slate-400">Enough to put a believable caller on air. Everything else is optional.</p></div></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label><span className="label">First name</span><input className="field" name="firstName" defaultValue={caller?.firstName} required /></label>
        <label><span className="label">Surname initial</span><input className="field" name="surnameInitial" defaultValue={caller?.surnameInitial ?? ""} maxLength={1} placeholder="M" /></label>
        <label><span className="label">Location</span><input className="field" name="location" defaultValue={caller?.location} required /></label>
        <label><span className="label">Occupation / identity</span><input className="field" name="occupation" defaultValue={caller?.occupation ?? ""} /></label>
        <label className="md:col-span-2 lg:col-span-4"><span className="label">What are they calling about?</span><input className="field" name="issueHeadline" defaultValue={caller?.issueHeadline} placeholder="A clear, listener-facing headline" required /></label>
        <label className="md:col-span-2 lg:col-span-4"><span className="label">Producer briefing</span><textarea className="field min-h-24" name="openingSummary" defaultValue={caller?.openingSummary} placeholder="Two or three sentences are plenty: what happened, and why are they calling now?" required /></label>
      </div>
    </section>

    <details className="panel panel-pad">
      <summary className="cursor-pointer list-none"><div className="flex items-center gap-3"><SlidersHorizontal className="h-5 w-5 text-slate-400" /><div><p className="font-bold text-slate-100">Identity and library details</p><p className="mt-0.5 text-xs text-slate-500">Age, relationship context and topic tags</p></div></div></summary>
      <div className="mt-4 grid gap-4 border-t border-slate-700/70 pt-4 md:grid-cols-3">
        <label><span className="label">Age</span><input className="field" name="age" type="number" min="18" max="120" defaultValue={caller?.age ?? ""} /></label>
        <label><span className="label">Relationship context</span><input className="field" name="relationshipStatus" defaultValue={caller?.relationshipStatus ?? ""} placeholder="Optional" /></label>
        <label><span className="label">Topic tags</span><input className="field" name="topicTags" defaultValue={tags.join(", ")} placeholder="work, friendship, technology" /></label>
      </div>
    </details>

    <details className="panel panel-pad">
      <summary className="cursor-pointer list-none"><div className="flex items-center gap-3"><Volume2 className="h-5 w-5 text-slate-400" /><div><p className="font-bold text-slate-100">Voice and delivery</p><p className="mt-0.5 text-xs text-slate-500">Use the defaults or cast this caller more precisely</p></div></div></summary>
      <div className="mt-4 grid gap-4 border-t border-slate-700/70 pt-4 md:grid-cols-2">
        <label><span className="label">Voice presentation</span><select className="field" name="voicePresentation" defaultValue={selectedVoicePresentation}><option value="any">Any / keep selected voice</option><option value="feminine">Feminine</option><option value="masculine">Masculine</option><option value="neutral">Neutral</option></select></label>
        <label><span className="label">Selected voice</span><select className="field" name="voiceId" defaultValue={selectedVoice}>{OPENAI_VOICE_OPTIONS.map((voice) => <option key={voice.id} value={voice.id}>{voice.label} — {voice.description}</option>)}</select></label>
        <label><span className="label">Delivery pace</span><select className="field" name="pacing" defaultValue={string(performance.pacing, "Conversational")}><option>Measured</option><option>Conversational</option><option>Brisk</option><option>Animated</option></select></label>
        <label><span className="label">ElevenLabs voice ID</span><input className="field" name="elevenLabsVoiceId" defaultValue={elevenLabsVoiceId} placeholder="Optional; otherwise uses the Agent default" /></label>
        <label className="md:col-span-2"><span className="label">Fish Audio voice model ID</span><input className="field" name="fishAudioVoiceId" defaultValue={fishAudioVoiceId} placeholder="Optional; otherwise uses FISH_AUDIO_VOICE_ID or Fish's default voice" /><span className="mt-1 block text-xs text-slate-500">Copy the model ID from a Fish Audio voice page. This only affects the optional Fish route.</span></label>
      </div>
    </details>

    <details className="panel panel-pad">
      <summary className="cursor-pointer list-none"><div className="flex items-center gap-3"><Pencil className="h-5 w-5 text-slate-400" /><div><p className="font-bold text-slate-100">Fine-tune caller behaviour</p><p className="mt-0.5 text-xs text-slate-500">Optional. The runtime supplies natural defaults when these are blank.</p></div></div></summary>
      <div className="mt-4 grid gap-4 border-t border-slate-700/70 pt-4 md:grid-cols-2">
        <label><span className="label">Desired outcome</span><textarea className="field min-h-20" name="centralWant" defaultValue={string(character.centralWant)} placeholder="What would make this call feel worthwhile?" /></label>
        <label><span className="label">How they see themselves</span><textarea className="field min-h-20" name="worldview" defaultValue={string(character.worldview)} placeholder="The story they tell themselves" /></label>
        <label><span className="label">Behaviour under pressure</span><textarea className="field min-h-20" name="actualBehaviour" defaultValue={string(character.actualBehaviour)} placeholder="Open, evasive, thoughtful, stubborn…" /></label>
        <label><span className="label">Internal tension</span><textarea className="field min-h-20" name="comicContradiction" defaultValue={string(character.comicContradiction)} placeholder="Mixed motives or uncertainty; it does not need to be funny" /></label>
        <label className="md:col-span-2"><span className="label">Speaking style</span><textarea className="field min-h-20" name="speechStyle" defaultValue={string(character.speechStyle)} placeholder="Natural vocabulary, rhythm, confidence and any verbal habits" /></label>
        <label className="md:col-span-2"><span className="label">Withheld detail</span><textarea className="field min-h-20" name="hiddenTruth" defaultValue={string(story.hiddenTruth)} placeholder="Optional. Leave blank when the caller can be completely open." /></label>
        <label><span className="label">Conversation routes</span><textarea className="field min-h-24" name="escalationBeats" defaultValue={lines(story.escalationBeats)} placeholder="Optional paths, one per line. These can deepen, soften or redirect the call." /></label>
        <label><span className="label">Host questions</span><textarea className="field min-h-24" name="suggestedQuestions" defaultValue={lines(hostSupport.suggestedQuestions)} placeholder="Optional prompts, one per line" /></label>
      </div>
    </details>

    <details className="panel panel-pad">
      <summary className="cursor-pointer list-none"><div className="flex items-center gap-3"><ImageIcon className="h-5 w-5 text-slate-400" /><div><p className="font-bold text-slate-100">Caller graphic</p><p className="mt-0.5 text-xs text-slate-500">Optional avatar, generated portrait or owned image</p></div></div></summary>
      <input type="hidden" name="portraitUrl" value={portraitUrl} />
      <div className="mt-4 space-y-3 border-t border-slate-700/70 pt-4">
        {portraitUrl && <div className="flex items-center gap-3 rounded-xl border border-slate-700/70 bg-slate-900/70 p-3"><img className="h-16 w-16 rounded-lg object-cover" src={portraitUrl} alt="Current caller portrait" /><div><p className="text-sm font-bold text-white">Current portrait</p><p className="mt-1 text-xs text-slate-400">Choose another option below or keep this one.</p></div></div>}
        <details className="rounded-xl border border-slate-700/70 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200">Avatar library</summary><div className="mt-3"><CallerAvatarPicker defaultSeed={`${caller?.firstName ?? "new"}-${caller?.location ?? "caller"}`} onUseAsPortrait={setPortraitUrl} /></div></details>
        <details className="rounded-xl border border-slate-700/70 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200">Generate an original portrait</summary><div className="mt-3"><CallerImageGenerator defaultPrompt={imagePrompt} onUseAsPortrait={setPortraitUrl} /></div></details>
        <details className="rounded-xl border border-slate-700/70 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200">Use a custom image URL</summary><label className="mt-3 block"><span className="label">Image URL</span><input className="field" type="url" value={portraitUrl} onChange={(event) => setPortraitUrl(event.target.value)} placeholder="https://…" /><span className="mt-1 block text-xs text-slate-500">Only use an image you have the right to display.</span></label></details>
      </div>
    </details>

    <div className="sticky bottom-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/30 bg-slate-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur"><p className="text-xs text-slate-400">Only the essentials are required.</p><div className="flex gap-2">{caller && <button className="button-secondary" type="button" onClick={() => setEditing(false)}><X className="h-4 w-4" /> Cancel</button>}<button className="button-primary" type="submit"><Save className="h-4 w-4" /> {submitLabel}</button></div></div>
  </form>;
}
