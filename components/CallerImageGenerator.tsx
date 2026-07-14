"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type GraphicKind = "portrait" | "topic";

export function CallerImageGenerator({ defaultPrompt, onUseAsPortrait, callerId }: { defaultPrompt: string; onUseAsPortrait?: (url: string) => void; callerId?: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<GraphicKind>(callerId ? "topic" : "portrait");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Generate an original portrait or on-air topic graphic from a short creative brief.");

  async function generate() {
    setBusy(true);
    setMessage("Generating image…");
    try {
      const response = await fetch("/api/images/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, kind }) });
      const data = await response.json() as { dataUrl?: string; error?: string };
      if (!response.ok || !data.dataUrl) throw new Error(data.error ?? "Image generation failed.");
      setImageUrl(data.dataUrl);
      setMessage("Image ready. Choose how to use it before saving the caller.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addToVisuals() {
    if (!imageUrl || !callerId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/callers/${callerId}/visuals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: `AI graphic: ${prompt.slice(0, 88)}`, url: imageUrl }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to add the generated graphic.");
      router.refresh();
      setMessage("Graphic added to this caller’s visual library. The host can trigger it manually from Studio.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add generated graphic.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-xl border border-violet-400/30 bg-violet-400/5 p-4"><p className="eyebrow">AI image generator</p><h3 className="mt-1 text-base font-bold text-white">Create an original caller graphic</h3><p className="mt-2 text-xs leading-5 text-slate-300">Uses your server-side OpenAI key. Use a portrait in the caller form, or make a landscape topic image for the host’s manually triggered Visuals module.</p><div className="mt-3 grid gap-3 md:grid-cols-[11rem_1fr_auto]"><select className="field !mt-0" value={kind} onChange={(event) => setKind(event.target.value as GraphicKind)}><option value="portrait">Caller portrait</option>{callerId && <option value="topic">On-air topic graphic</option>}</select><input className="field !mt-0" value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="AI image creative brief" /><button type="button" className="button-secondary" disabled={busy || prompt.trim().length < 8} onClick={() => void generate()}>{busy ? "Generating…" : "Generate"}</button></div><p className="mt-3 text-xs text-slate-300" role="status">{message}</p>{imageUrl && <div className="mt-4 grid gap-3 sm:grid-cols-[12rem_1fr]"><img className="aspect-square w-full rounded-lg object-cover" src={imageUrl} alt="Generated caller concept" /><div className="flex flex-wrap content-start gap-2">{onUseAsPortrait && <button type="button" className="button-primary" onClick={() => { onUseAsPortrait(imageUrl); setMessage("Applied to the optional custom image field. Save the caller to keep it."); }}>Use as caller portrait</button>}{callerId && <button type="button" className="button-secondary" disabled={busy} onClick={() => void addToVisuals()}>Add to Visuals</button>}</div></div>}</section>;
}
