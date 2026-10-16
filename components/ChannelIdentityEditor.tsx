"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, WandSparkles } from "lucide-react";
import { ChannelArtwork } from "@/components/ChannelArtwork";
import { channelFonts, channelPalettes, type ShowIdentity } from "@/lib/show-identity";

export function ChannelIdentityEditor({ showId, title, initialIdentity, initiallyOpen = false }: {
  showId: string; title: string; initialIdentity: ShowIdentity; initiallyOpen?: boolean;
}) {
  const router = useRouter();
  const [identity, setIdentity] = useState(initialIdentity);
  const [saved, setSaved] = useState(initialIdentity);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(identity) !== JSON.stringify(saved);
  const update = (patch: Partial<ShowIdentity>) => { setIdentity((current) => ({ ...current, ...patch })); setMessage(""); setError(""); };
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Choose a PNG, JPEG or WebP under 5 MB."); return; }
    setBusy(true); setError(""); setMessage("Uploading image…");
    try {
      const response = await fetch(`/api/shows/${showId}/artwork`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setIdentity((current) => ({ ...current, artworkUrl: data.artworkUrl }));
      setMessage("Image ready. Save artwork to put it on your channel.");
    } catch (error) { setMessage(""); setError(error instanceof Error ? error.message : "Upload failed. Please retry."); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/shows/${showId}/artwork`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(identity) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setSaved(data.identity); setIdentity(data.identity); setMessage("Saved to your channel, Studio and broadcast output."); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Save failed. Please retry."); }
    finally { setBusy(false); }
  }
  return <details className="panel panel-pad mt-5" open={initiallyOpen}>
    <summary className="cursor-pointer text-sm font-bold text-white">Channel artwork <span className="ml-2 font-normal text-slate-400">Create a look or upload your own</span></summary>
    <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div><ChannelArtwork title={title} identity={identity} className="w-full rounded-xl border border-white/10" /><div className="mt-3 flex items-center gap-3"><ChannelArtwork title={title} identity={identity} compact className="h-12 w-12 rounded-lg" decorative /><p className="text-xs leading-5 text-slate-400">Preview · Also used in the channel switcher, Studio and broadcast. Uploaded images fill the card; keep important details near the centre.</p></div></div>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={busy} className="space-y-4">
          <p className="text-sm leading-6 text-slate-400">Generate a typographic graphic from your channel name. Free, instant and editable—no AI key needed.</p>
          <div className="flex flex-wrap gap-2"><button className="button-secondary" type="button" onClick={() => { update({ artworkUrl: null }); setMessage("Generated from your channel name and style below. Save when ready."); }}><WandSparkles className="h-4 w-4" />Generate from title</button><label className={`button-secondary relative ${busy ? "opacity-50" : "cursor-pointer"}`}><Upload className="h-4 w-4" />Upload image<input className="absolute inset-0 w-full cursor-pointer opacity-0" aria-label="Upload channel image" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
          <p className="text-xs text-slate-500">PNG, JPEG or WebP · max 5 MB / 20 MP. Use artwork you have permission to broadcast.</p>
          <div className="grid grid-cols-2 gap-3"><label><span className="label">Colour palette</span><select className="field" value={identity.palette} onChange={(event) => update({ palette: event.target.value as ShowIdentity["palette"] })}>{Object.entries(channelPalettes).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}</select></label><label><span className="label">Title font</span><select className="field" value={identity.font} onChange={(event) => update({ font: event.target.value as ShowIdentity["font"] })}>{Object.entries(channelFonts).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}</select></label></div>
          <label className="block"><span className="label">Show label</span><input className="field" value={identity.label} maxLength={36} required onChange={(event) => update({ label: event.target.value })} /></label>
          <details><summary className="cursor-pointer text-xs font-bold text-cyan-200">Tagline & graphic pattern</summary><div className="mt-3 space-y-3"><label className="block"><span className="label">Tagline</span><input className="field" value={identity.tagline} maxLength={100} onChange={(event) => update({ tagline: event.target.value })} /></label><label className="block"><span className="label">Pattern</span><select className="field" value={identity.motif} onChange={(event) => update({ motif: event.target.value as ShowIdentity["motif"] })}><option value="rings">On-air rings</option><option value="burst">Starburst</option><option value="verdict">Verdict stamp</option><option value="waves">Sound waves</option></select></label></div></details>
          {identity.artworkUrl && <p className="text-xs leading-5 text-slate-400">Using your uploaded image. Font and label still style the broadcast header; Generate from title switches back to editable artwork.</p>}
          <div className="flex flex-wrap gap-2"><button className="button-primary" disabled={busy || !identity.label.trim()}>{busy ? "Working…" : "Save artwork"}</button>{dirty && <button type="button" className="button-secondary" onClick={() => { setIdentity(saved); setMessage(""); setError(""); }}>Discard changes</button>}</div>
        </fieldset>
        {message && <p role="status" className="mt-3 text-sm text-cyan-200">{message}</p>}{error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
      </form>
    </div>
  </details>;
}
