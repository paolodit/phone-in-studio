import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";
import { readFile, writeFile } from "node:fs/promises";

// Compose the existing artwork and editable copy into a fixed-size share card.
// Run from the repository root: node scripts/render-nextcaller-social.mjs
const logo = await readFile(new URL("../public/branding/nextcaller-wordmark.png", import.meta.url));
const portrait = await readFile(new URL("../public/branding/caller-chatty.png", import.meta.url));
const dataUrl = (bytes) => `data:image/png;base64,${bytes.toString("base64")}`;
const response = new ImageResponse(
  h("div", { style: {
    width: "100%", height: "100%", display: "flex", flexDirection: "column",
    background: "#38d3ee", color: "#062551", padding: "34px 64px 44px",
    fontFamily: "sans-serif", position: "relative",
  } },
    h("div", { style: { display: "flex", height: 288, overflow: "hidden", alignItems: "center", justifyContent: "center" } },
      h("img", { src: dataUrl(logo), width: 1072, height: 423, style: { objectFit: "contain", marginTop: -18 } }),
    ),
    h("div", { style: { display: "flex", marginTop: 24, fontSize: 56, fontWeight: 700, letterSpacing: -2, lineHeight: 1.06, width: 850 } },
      "Your mic. A whole cast of AI callers.",
    ),
    h("div", { style: { display: "flex", fontSize: 25, marginTop: 22, width: 850 } },
      "Create the characters. Host the conversation.",
    ),
    h("div", { style: { display: "flex", fontSize: 25, fontWeight: 700, marginTop: "auto" } }, "nextcaller.xyz"),
    h("img", { src: dataUrl(portrait), width: 195, height: 195, style: { position: "absolute", right: 37, bottom: 31, objectFit: "contain" } }),
  ),
  { width: 1200, height: 630 },
);
const output = new URL("../public/branding/nextcaller-social.png", import.meta.url);
await writeFile(output, Buffer.from(await response.arrayBuffer()));
console.log(`Saved ${output.pathname} (1200 × 630)`);
