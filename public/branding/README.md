# NextCaller artwork

NextCaller is the hosted service at https://nextcaller.xyz for this open-source
AI Phone-In Studio. The project stays self-hostable; accounts, payments and
provisioning are maintained separately.

Selected identity: F, Cast of Characters, with an indignant first l caller.
The wordmark, caller icon and two companion portraits were produced with
built-in Codex ImageGen. Exact prompts are in [prompts.json](prompts.json).

| Asset | Use |
| --- | --- |
| nextcaller-wordmark.png | Transparent wordmark for light or cyan surfaces. |
| nextcaller-icon.png | Indignant caller portrait; favicon and pricing illustration. |
| caller-chatty.png | How-it-works and signup illustration. |
| caller-relaxed.png | Open-source, sign-in and footer illustration. |
| nextcaller-social.png | Opaque 1200 × 630 social and GitHub sharing card. |

The social card composes the existing artwork and editable type using Next.js
ImageResponse. Rebuild it from the repository root with
`node scripts/render-nextcaller-social.mjs`. No inference is used when rendering
the sharing card. The private website copies these canonical files unchanged.

The source artwork is raster PNG. There is no editable vector master yet.
For the wordmark's transparent margins, the website uses a 3.75:1 frame with
object-fit: cover and object-position: 50% 40%; this keeps all characters visible.
