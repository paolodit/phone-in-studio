"use client";

import { useState } from "react";
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
  const selectedVoice = ({ "mock-warm-welsh": "coral", "mock-dry-welsh": "cedar", "mock-confident-welsh": "shimmer", "mock-gravel-welsh": "echo", "mock-keen-welsh": "ash" } as Record<string, string>)[string(performance.voiceId)] ?? string(performance.voiceId, "coral");
  const elevenLabsVoiceId = string(performance.elevenLabsVoiceId);
  const imagePrompt = `${caller?.firstName ?? "A fictional adult caller"}, ${caller?.location ?? "a local radio studio"}. ${caller?.issueHeadline ?? "A strange everyday complaint"}`;

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
        <div className="md:col-span-2"><CallerAvatarPicker defaultSeed={`${caller?.firstName ?? "new"}-${caller?.location ?? "caller"}`} onUseAsPortrait={setPortraitUrl} /></div>
        <div className="md:col-span-2"><CallerImageGenerator defaultPrompt={imagePrompt} onUseAsPortrait={setPortraitUrl} /></div>
        <details className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 md:col-span-2"><summary className="cursor-pointer text-sm font-semibold text-slate-200">Use a custom image URL <span className="font-normal text-slate-500">(optional)</span></summary><label className="mt-3 block"><span className="label">Image URL</span><input className="field" name="portraitUrl" type="url" value={portraitUrl} onChange={(event) => setPortraitUrl(event.target.value)} placeholder="https://…" /><span className="mt-1 block text-xs text-slate-500">Only use this for an image you have the right to display. The avatar and AI image tools above fill this automatically.</span></label></details>
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
    <button className="button-primary" type="submit">{submitLabel}</button>
  </form>;
}
