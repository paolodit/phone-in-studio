import { readArtwork } from "@/lib/show-artwork-store";
export const runtime = "nodejs";
// Channel artwork is public presentation material. Hashed URLs contain no credentials.
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  try {
    const image = await readArtwork((await params).file);
    return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
