import { z } from "zod";

export const channelPalettes = {
  paper: { name: "Verdict red", background: "#f4efdf", ink: "#202027", accent: "#d53534", secondary: "#dfd5bc" },
  electric: { name: "Electric violet", background: "#23133e", ink: "#faffef", accent: "#d7fc71", secondary: "#7853c7" },
  butter: { name: "Hotline yellow", background: "#f5d95d", ink: "#242744", accent: "#b6334c", secondary: "#eeb948" },
  ocean: { name: "Midnight cyan", background: "#102e40", ink: "#ecfbff", accent: "#70e1e5", secondary: "#20536d" },
  coral: { name: "Coral club", background: "#431e36", ink: "#fff0e8", accent: "#ffac85", secondary: "#7d3856" },
  forest: { name: "After-hours green", background: "#173b32", ink: "#f0f4dd", accent: "#c5df90", secondary: "#30604c" },
} as const;
export const channelFonts = {
  editorial: { name: "Editorial", family: "Georgia, 'Times New Roman', serif" },
  poster: { name: "Headline", family: "'Arial Black', Impact, sans-serif" },
  rounded: { name: "Friendly", family: "'Trebuchet MS', Arial, sans-serif" },
  mono: { name: "Typewriter", family: "'Courier New', monospace" },
} as const;
export const showIdentitySchema = z.object({
  palette: z.enum(["paper", "electric", "butter", "ocean", "coral", "forest"]),
  font: z.enum(["editorial", "poster", "rounded", "mono"]),
  motif: z.enum(["rings", "burst", "verdict", "waves"]),
  label: z.string().trim().min(1).max(36),
  tagline: z.string().trim().max(100),
  artworkUrl: z.string().regex(/^\/api\/show-artwork\/[a-f0-9]{64}\.webp$/).nullable(),
}).strict();
export type ShowIdentity = z.infer<typeof showIdentitySchema>;

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function defaultShowIdentity(title: string): ShowIdentity {
  let hash = 0; for (const letter of title) hash = ((hash * 31) + letter.charCodeAt(0)) >>> 0;
  const palettes = Object.keys(channelPalettes) as ShowIdentity["palette"][];
  return { palette: palettes[hash % palettes.length], font: "poster", motif: "rings", label: "INDEPENDENT PHONE-IN", tagline: "Good conversations. Unexpected callers.", artworkUrl: null };
}
/** Public allow-list only. Never send the complete brandingConfig to output. */
export function readShowIdentity(config: unknown, title: string): ShowIdentity {
  const defaults = defaultShowIdentity(title); const input = object(object(config).identity);
  const result = showIdentitySchema.safeParse({ ...defaults, ...Object.fromEntries(Object.keys(defaults).map((key) => [key, input[key] ?? defaults[key as keyof ShowIdentity]])) });
  return result.success ? result.data : defaults;
}
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const wrap = (text: string, limit: number) => {
  const words = text.trim().split(/\s+/).flatMap((word) => word.match(new RegExp(`.{1,${limit}}`, "gu")) ?? []);
  const lines: string[] = []; let line = "";
  for (const word of words) { if (line && `${line} ${word}`.length > limit) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word; }
  if (line) lines.push(line); return lines;
};
export function showArtworkSvg(title: string, identity: ShowIdentity, compact = false): string {
  const palette = channelPalettes[identity.palette];
  const pattern = identity.motif === "burst"
    ? `<path d="M850 0 880 180 1024 95 925 265 1024 390 865 360 820 550 775 360 590 430 700 260 585 100 780 180Z" fill="${palette.accent}" opacity=".21"/>`
    : identity.motif === "verdict"
      ? `<circle cx="875" cy="255" r="205" fill="none" stroke="${palette.accent}" stroke-width="25" opacity=".15"/><path d="m760 260 75 75 135-170" fill="none" stroke="${palette.accent}" stroke-width="24" opacity=".18"/>`
      : identity.motif === "waves"
        ? `<path d="M650 0q-230 150 0 320t0 320M760 0q-230 150 0 320t0 320M870 0q-230 150 0 320t0 320M980 0q-230 150 0 320t0 320" fill="none" stroke="${palette.accent}" stroke-width="30" opacity=".12"/>`
        : `<g fill="none" stroke="${palette.accent}" opacity=".14"><circle cx="960" cy="360" r="240" stroke-width="35"/><circle cx="960" cy="360" r="160" stroke-width="25"/><circle cx="960" cy="360" r="80" stroke-width="18"/></g>`;
  if (compact) {
    const initials = title.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => Array.from(word)[0]).join("").toUpperCase() || "FM";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="25" fill="${palette.background}"/><circle cx="115" cy="5" r="55" fill="${palette.accent}" opacity=".3"/><path d="M19 95h82" stroke="${palette.accent}" stroke-width="7"/><text x="60" y="75" text-anchor="middle" fill="${palette.ink}" font-family="${escape(channelFonts[identity.font].family)}" font-size="43" font-weight="900">${escape(initials)}</text></svg>`;
  }
  let lineLimit = title.length > 65 ? 28 : title.length > 35 ? 21 : 14;
  let lines = wrap(title, lineLimit);
  while (lines.length > 5) lines = wrap(title, ++lineLimit);
  const size = lines.length > 3 ? 64 : lines.length > 2 ? 96 : 116;
  const startY = lines.length > 2 ? 210 : 270;
  // Explicit text lengths keep artwork portable across browsers with different
  // local font metrics, including long unbroken names and all-capital titles.
  const fit = (text: string, size: number, max = 912) => `textLength="${Math.min(max, Array.from(text).length * size * .56)}" lengthAdjust="spacingAndGlyphs"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 640"><rect width="1024" height="640" fill="${palette.background}"/>${pattern}<path d="M56 48H968" stroke="${palette.ink}" opacity=".24"/><rect x="56" y="76" width="10" height="30" fill="${palette.accent}"/><text x="84" y="100" font-family="Arial,sans-serif" font-size="21" font-weight="700" letter-spacing="3" ${fit(identity.label, 25, 825)} fill="${palette.ink}">${escape(identity.label.toUpperCase())}</text><g fill="${palette.ink}" font-family="${escape(channelFonts[identity.font].family)}" font-weight="900" font-size="${size}" letter-spacing="-3">${lines.map((line, index) => `<text x="52" y="${startY + index * (size * 1.03)}" ${fit(line, size)}>${escape(line)}</text>`).join("")}</g><path d="M56 532H968" stroke="${palette.ink}" opacity=".24"/>${wrap(identity.tagline, 68).slice(0, 2).map((line, index) => `<text x="56" y="${574 + index * 27}" font-family="Arial,sans-serif" font-size="23" ${fit(line, 23)} fill="${palette.ink}">${escape(line)}</text>`).join("")}<circle cx="955" cy="97" r="10" fill="${palette.accent}"/></svg>`;
}
export function showArtworkUrl(title: string, identity: ShowIdentity, compact = false) {
  return identity.artworkUrl ?? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(showArtworkSvg(title, identity, compact))}`;
}
