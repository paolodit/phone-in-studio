export type StockImageProvider = "auto" | "pexels" | "pixabay";

export type StockImageResult = {
  id: string;
  provider: Exclude<StockImageProvider, "auto">;
  imageUrl: string;
  previewUrl: string;
  alt: string;
  creator: string;
  sourceUrl: string;
};

type PexelsResponse = { photos?: Array<{ id: number; alt?: string; photographer?: string; url?: string; src?: { large?: string; medium?: string } }> };
type PixabayResponse = { hits?: Array<{ id: number; tags?: string; user?: string; pageURL?: string; webformatURL?: string; largeImageURL?: string }> };

function configuredProvider(requested: StockImageProvider) {
  if (requested === "pexels") return process.env.PEXELS_API_KEY ? "pexels" : null;
  if (requested === "pixabay") return process.env.PIXABAY_API_KEY ? "pixabay" : null;
  if (process.env.PEXELS_API_KEY) return "pexels";
  if (process.env.PIXABAY_API_KEY) return "pixabay";
  return null;
}

export async function searchStockImages(query: string, requested: StockImageProvider): Promise<{ provider: Exclude<StockImageProvider, "auto">; results: StockImageResult[] }> {
  const provider = configuredProvider(requested);
  if (!provider) {
    const required = requested === "auto" ? "PEXELS_API_KEY or PIXABAY_API_KEY" : requested === "pexels" ? "PEXELS_API_KEY" : "PIXABAY_API_KEY";
    throw new Error(`Add ${required} to local.env, then restart the development server to search stock images.`);
  }

  if (provider === "pexels") {
    const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape`, {
      headers: { Authorization: process.env.PEXELS_API_KEY ?? "" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(response.status === 401 ? "Pexels rejected the API key." : "Pexels image search is unavailable right now.");
    const body = await response.json() as PexelsResponse;
    return {
      provider,
      results: (body.photos ?? []).flatMap((photo) => photo.src?.large && photo.src.medium ? [{
        id: `pexels-${photo.id}`,
        provider,
        imageUrl: photo.src.large,
        previewUrl: photo.src.medium,
        alt: photo.alt || query,
        creator: photo.photographer || "Pexels contributor",
        sourceUrl: photo.url || "https://www.pexels.com",
      }] : []),
    };
  }

  const response = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(process.env.PIXABAY_API_KEY ?? "")}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=12`, { cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 400 ? "Pixabay rejected the API key or search request." : "Pixabay image search is unavailable right now.");
  const body = await response.json() as PixabayResponse;
  return {
    provider,
    results: (body.hits ?? []).flatMap((image) => image.largeImageURL && image.webformatURL ? [{
      id: `pixabay-${image.id}`,
      provider,
      imageUrl: image.largeImageURL,
      previewUrl: image.webformatURL,
      alt: image.tags || query,
      creator: image.user || "Pixabay contributor",
      sourceUrl: image.pageURL || "https://pixabay.com",
    }] : []),
  };
}
