import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const MAX_ARTWORK_BYTES = 5 * 1024 * 1024;
const directory = path.join(process.cwd(), "data", "show-artwork");
const filenamePattern = /^[a-f0-9]{64}\.webp$/;

/** Decode and re-encode: never serve uploaded SVG, HTML, metadata or original bytes. */
export async function normaliseArtwork(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_ARTWORK_BYTES) throw new Error("Choose an image under 5 MB.");
  const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "error", animated: false });
  const metadata = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) {
    throw new Error("Choose a still PNG, JPEG or WebP image.");
  }
  return image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
}
export async function storeArtwork(bytes: Buffer) {
  const output = await normaliseArtwork(bytes);
  const filename = `${createHash("sha256").update(output).digest("hex")}.webp`;
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), output);
  return `/api/show-artwork/${filename}`;
}
export async function readArtwork(filename: string) {
  if (!filenamePattern.test(filename)) throw new Error("Invalid artwork name.");
  return readFile(path.join(directory, filename));
}
export async function artworkExists(url: string) {
  const filename = url.replace(/^\/api\/show-artwork\//, "");
  if (!filenamePattern.test(filename)) return false;
  try { await access(path.join(directory, filename)); return true; } catch { return false; }
}

export async function limitedRequestBody(request: Request, limit: number) {
  const declared = Number(request.headers.get("content-length"));
  if (declared > limit) throw new Error("Request is too large.");
  if (!request.body) throw new Error("Empty request.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      total += value.length;
      if (total > limit) { await reader.cancel(); throw new Error("Request is too large."); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}
