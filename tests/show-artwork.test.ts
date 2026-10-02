import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { limitedRequestBody, MAX_ARTWORK_BYTES, normaliseArtwork, readArtwork, artworkExists } from "@/lib/show-artwork-store";

describe("channel artwork upload safety", () => {
  it("decodes, resizes, strips metadata and serves only re-encoded WebP", async () => {
    const input = await sharp({ create: { width: 1800, height: 900, channels: 3, background: "#f5d95d" } }).png().withMetadata().toBuffer();
    const output = await normaliseArtwork(input); const meta = await sharp(output).metadata();
    expect(meta.format).toBe("webp"); expect(meta.width).toBe(1600); expect(meta.height).toBe(800); expect(meta.exif).toBeUndefined();
  });
  it("rejects SVG, broken images, oversized input and images above the pixel limit", async () => {
    await expect(normaliseArtwork(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'))).rejects.toThrow();
    await expect(normaliseArtwork(Buffer.from("not an image"))).rejects.toThrow();
    await expect(normaliseArtwork(Buffer.alloc(MAX_ARTWORK_BYTES + 1))).rejects.toThrow();
    const giant = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "black" } }).png().toBuffer();
    await expect(normaliseArtwork(giant)).rejects.toThrow();
  });
  it("rejects traversal and non-hashed filenames without reading files", async () => {
    await expect(readArtwork("../../.env.local")).rejects.toThrow("Invalid");
    await expect(readArtwork("image.svg")).rejects.toThrow("Invalid");
    expect(await artworkExists("/api/show-artwork/../../.env.local")).toBe(false);
  });
  it("bounds streamed bodies even without a content length", async () => {
    const request = new Request("http://localhost/test", { method: "POST", body: "abcdef" });
    await expect(limitedRequestBody(request, 5)).rejects.toThrow("too large");
    expect((await limitedRequestBody(new Request("http://localhost/test", { method: "POST", body: "abc" }), 5)).toString()).toBe("abc");
  });
});
