"use client";

import { useState } from "react";
import { Check, Images } from "lucide-react";
import { useRouter } from "next/navigation";
import type { StockImageProvider, StockImageResult } from "@/lib/stock-images";

export function CallerImageFeedPicker({ callerId, defaultQuery, existingVisualUrls }: { callerId: string; defaultQuery: string; existingVisualUrls: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [provider, setProvider] = useState<StockImageProvider>("auto");
  const [results, setResults] = useState<StockImageResult[]>([]);
  const [addedUrls, setAddedUrls] = useState(() => new Set(existingVisualUrls));
  const [message, setMessage] = useState("Search Pexels or Pixabay, then add only the images you want available to the host.");
  const [searching, setSearching] = useState(false);
  const [addingUrl, setAddingUrl] = useState<string | null>(null);

  const search = async () => {
    setSearching(true);
    setMessage("Searching image library…");
    try {
      const response = await fetch(`/api/images/search?query=${encodeURIComponent(query)}&provider=${provider}`, { cache: "no-store" });
      const data = await response.json() as { error?: string; provider?: string; results?: StockImageResult[] };
      if (!response.ok) throw new Error(data.error ?? "Image search failed.");
      setResults(data.results ?? []);
      setMessage(data.results?.length ? `${data.results.length} ${data.provider} images ready to review.` : "No images found. Try a broader, visual search phrase.");
    } catch (error) {
      setResults([]);
      setMessage(error instanceof Error ? error.message : "Image search failed.");
    } finally {
      setSearching(false);
    }
  };

  const addImage = async (image: StockImageResult) => {
    setAddingUrl(image.imageUrl);
    setMessage("Adding image to this caller’s Visuals tray…");
    try {
      const providerName = image.provider === "pexels" ? "Pexels" : "Pixabay";
      const response = await fetch(`/api/callers/${callerId}/visuals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: image.alt, url: image.imageUrl, creditText: `${image.creator} · ${providerName}`, creditUrl: image.sourceUrl }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to add the visual.");
      setAddedUrls((current) => new Set([...current, image.imageUrl]));
      setMessage("Added. This image is now in the host’s Visuals tray for this caller.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add the visual.");
    } finally {
      setAddingUrl(null);
    }
  };

  const addedResults = results.filter((image) => addedUrls.has(image.imageUrl));

  return <section className="panel panel-pad">
    <p className="eyebrow">Image feed</p>
    <h2 className="mt-1 text-lg font-bold text-white">Find a topic image</h2>
    <p className="mt-2 text-sm text-slate-400">Images stay backstage until the host manually triggers one from Studio.</p>
    {addedResults.length > 0 && <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3"><Images className="h-5 w-5 shrink-0 text-emerald-300" /><div className="flex -space-x-2">{addedResults.slice(0, 5).map((image) => <img key={image.imageUrl} className="h-10 w-10 rounded-lg border-2 border-slate-900 object-cover" src={image.previewUrl} alt="" />)}</div><p className="text-xs text-emerald-100">{addedResults.length} from this search added to Visuals</p></div>}
    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_11rem_auto]">
      <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Image search terms" />
      <select className="field" value={provider} onChange={(event) => setProvider(event.target.value as StockImageProvider)} aria-label="Image provider"><option value="auto">Best configured provider</option><option value="pexels">Pexels</option><option value="pixabay">Pixabay</option></select>
      <button type="button" onClick={() => void search()} disabled={searching || query.trim().length < 2} className="button-secondary">{searching ? "Searching…" : "Search images"}</button>
    </div>
    <p className="mt-3 text-xs text-slate-400" role="status">{message}</p>
    {results.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{results.map((image) => {
      const added = addedUrls.has(image.imageUrl);
      return <article key={image.id} className={`overflow-hidden rounded-xl border bg-slate-950 ${added ? "border-emerald-400/50" : "border-slate-700"}`}><img className="h-36 w-full object-cover" src={image.previewUrl} alt={image.alt} /><div className="p-3"><p className="line-clamp-2 text-sm font-semibold text-white">{image.alt}</p><a href={image.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-cyan-300 hover:underline">{image.provider} · {image.creator}</a><button type="button" className={`mt-3 w-full text-xs ${added ? "button-secondary !border-emerald-400/30 !text-emerald-200" : "button-secondary"}`} disabled={added || addingUrl !== null} onClick={() => void addImage(image)}>{added ? <><Check className="h-3.5 w-3.5" /> Added to Visuals</> : addingUrl === image.imageUrl ? "Adding…" : "Add to Visuals"}</button></div></article>;
    })}</div>}
  </section>;
}
