"use client";

import { useState } from "react";
import type { StockImageProvider, StockImageResult } from "@/lib/stock-images";

export function CallerImageFeedPicker({ defaultQuery, addVisual }: { defaultQuery: string; addVisual: (formData: FormData) => void | Promise<void> }) {
  const [query, setQuery] = useState(defaultQuery);
  const [provider, setProvider] = useState<StockImageProvider>("auto");
  const [results, setResults] = useState<StockImageResult[]>([]);
  const [message, setMessage] = useState("Search Pexels or Pixabay for a topic image, then add one to this caller's broadcast visual library.");
  const [searching, setSearching] = useState(false);

  const search = async () => {
    setSearching(true);
    setMessage("Searching image library...");
    try {
      const response = await fetch(`/api/images/search?query=${encodeURIComponent(query)}&provider=${provider}`, { cache: "no-store" });
      const data = await response.json() as { error?: string; provider?: string; results?: StockImageResult[] };
      if (!response.ok) throw new Error(data.error ?? "Image search failed.");
      setResults(data.results ?? []);
      setMessage(data.results?.length ? `${data.results.length} ${data.provider} images ready to add.` : "No images found. Try a broader, visual search phrase.");
    } catch (error) {
      setResults([]);
      setMessage(error instanceof Error ? error.message : "Image search failed.");
    } finally {
      setSearching(false);
    }
  };

  return <section className="panel panel-pad mt-6">
    <p className="eyebrow">On-air image feed</p>
    <h2 className="mt-1 text-lg font-bold text-white">Find a topic image</h2>
    <p className="mt-2 text-sm text-slate-400">The image only appears on the broadcast when the host clicks it in Visuals; it never replaces the caller identity card.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_11rem_auto]">
      <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Image search terms" />
      <select className="field" value={provider} onChange={(event) => setProvider(event.target.value as StockImageProvider)} aria-label="Image provider"><option value="auto">Best configured provider</option><option value="pexels">Pexels</option><option value="pixabay">Pixabay</option></select>
      <button type="button" onClick={() => void search()} disabled={searching || query.trim().length < 2} className="button-secondary">{searching ? "Searching..." : "Search images"}</button>
    </div>
    <p className="mt-3 text-xs text-slate-400" role="status">{message}</p>
    {results.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{results.map((image) => <article key={image.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950"><img className="h-36 w-full object-cover" src={image.previewUrl} alt={image.alt} /><div className="p-3"><p className="line-clamp-2 text-sm font-semibold text-white">{image.alt}</p><a href={image.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-cyan-300 hover:underline">{image.provider} · {image.creator}</a><form action={addVisual} className="mt-3"><input type="hidden" name="label" value={`${image.provider === "pexels" ? "Pexels" : "Pixabay"}: ${image.alt}`} /><input type="hidden" name="url" value={image.imageUrl} /><button className="button-secondary w-full text-xs">Add to Visuals</button></form></div></article>)}</div>}
  </section>;
}
