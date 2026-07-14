"use client";

import { useMemo, useState } from "react";
import { Avatar, Style, type StyleDefinition } from "@dicebear/core";
import adventurer from "@dicebear/styles/adventurer.json";
import avataaarsNeutral from "@dicebear/styles/avataaars-neutral.json";
import loreleiNeutral from "@dicebear/styles/lorelei-neutral.json";
import notionists from "@dicebear/styles/notionists.json";
import openPeeps from "@dicebear/styles/open-peeps.json";
import personas from "@dicebear/styles/personas.json";

const AVATAR_STYLES = [
  { label: "Adventurer", definition: adventurer },
  { label: "Classic", definition: avataaarsNeutral },
  { label: "Illustrated", definition: loreleiNeutral },
  { label: "Editorial", definition: notionists },
  { label: "Open Peeps", definition: openPeeps },
  { label: "Persona", definition: personas },
] as const;

const backgrounds = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "f8d5a3", "b9fbc0"];

function avatarDataUri(definition: unknown, seed: string, background: string) {
  const style = new Style(definition as StyleDefinition);
  return new Avatar(style, { seed, size: 360, backgroundColor: [`#${background}`] }).toDataUri();
}

export function CallerAvatarPicker({ defaultSeed, onUseAsPortrait }: { defaultSeed: string; onUseAsPortrait: (url: string) => void }) {
  const [seed, setSeed] = useState(defaultSeed || "New caller");
  const [variation, setVariation] = useState(0);
  const options = useMemo(() => AVATAR_STYLES.map((style, index) => ({
    label: style.label,
    url: avatarDataUri(style.definition, `${seed}-${variation}-${style.label}`, backgrounds[index % backgrounds.length]),
  })), [seed, variation]);

  return <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="label">Avatar library</p><p className="mt-1 text-xs text-slate-400">Choose a polished, editable SVG avatar. It is saved directly with the caller, so it does not rely on a third-party image URL.</p></div><button className="button-secondary !px-3 !py-2 text-xs" type="button" onClick={() => setVariation((current) => current + 1)}>Shuffle options</button></div>
    <label className="mt-3 block"><span className="label">Avatar seed</span><input className="field !mt-1" value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="Use the caller name or a visual note" /></label>
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{options.map((option) => <button key={option.label} type="button" onClick={() => onUseAsPortrait(option.url)} className="group rounded-lg border border-slate-700 bg-slate-900 p-1 text-left hover:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300"><img className="aspect-square w-full rounded-md bg-slate-800 object-cover" src={option.url} alt={`${option.label} avatar option`} /><span className="mt-1 block truncate text-[10px] font-bold text-slate-300 group-hover:text-cyan-200">{option.label}</span></button>)}</div>
  </div>;
}
