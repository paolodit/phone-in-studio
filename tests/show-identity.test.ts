import { describe, expect, it } from "vitest";
import { defaultShowIdentity, readShowIdentity, showArtworkSvg, showArtworkUrl, showIdentitySchema } from "@/lib/show-identity";
import { buildShowFormatConfig } from "@/lib/show-format";

describe("channel identity", () => {
  it("gives existing and custom shows a stable editable identity", () => {
    expect(readShowIdentity(null, "Night Lines")).toEqual(defaultShowIdentity("Night Lines"));
    expect(defaultShowIdentity("Night Lines")).toEqual(defaultShowIdentity("Night Lines"));
  });
  it("allows only public identity fields across the broadcast boundary", () => {
    const identity = defaultShowIdentity("Test");
    expect(readShowIdentity({ identity: { ...identity, secret: "private" }, formatGuidance: "private" }, "Test")).toEqual(identity);
    expect(readShowIdentity({ identity: { palette: "nonexistent" } }, "Test")).toEqual(identity);
    expect(showIdentitySchema.safeParse({ ...identity, artworkUrl: "https://example.com/tracker.svg" }).success).toBe(false);
    expect(showIdentitySchema.safeParse({ ...identity, artworkUrl: "/api/show-artwork/../../secret" }).success).toBe(false);
  });
  it("escapes text in generated artwork and never interpolates executable markup", () => {
    const identity = { ...defaultShowIdentity("X"), label: '<img onerror="alert(1)">', tagline: "<script>alert(1)</script> & 'text'" };
    const svg = showArtworkSvg('<script>alert("X")</script>', identity);
    expect(svg).not.toContain("<script>"); expect(svg).not.toContain("<img"); expect(svg).toContain("&lt;script&gt;");
    expect(showArtworkSvg("<>", identity, true)).toContain("&lt;");
    expect(showArtworkUrl("Test", defaultShowIdentity("Test"))).toMatch(/^data:image\/svg\+xml/);
  });
  it("uses a stored image consistently, but preserves identity when other options change", () => {
    const identity = { ...defaultShowIdentity("Test"), artworkUrl: `/api/show-artwork/${"a".repeat(64)}.webp` };
    expect(showArtworkUrl("Test", identity, true)).toBe(identity.artworkUrl);
    expect(buildShowFormatConfig({ title: "Renamed" }, { identity }).identity).toEqual(identity);
  });
  it("fits long titles without dropping words or relying on installed font widths", () => {
    const title = "EXTRAORDINARYXX ".repeat(8).trim();
    const svg = showArtworkSvg(title, defaultShowIdentity(title));
    expect(svg.match(/EXTRAORDINARYXX/g)).toHaveLength(8);
    expect(svg).toContain('lengthAdjust="spacingAndGlyphs"');
    expect([...svg.matchAll(/textLength="([\d.]+)"/g)].every((match) => Number(match[1]) <= 912)).toBe(true);
  });
});
