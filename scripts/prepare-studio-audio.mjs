// Rebuild the redistributable audio bundle. Needs ffmpeg on PATH; no API keys.
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "public", "audio");
const catalog = JSON.parse(await readFile(path.join(output, "catalog.json"), "utf8"));
const temporary = await mkdtemp(path.join(tmpdir(), "phone-in-audio-"));
const onlyEffects = process.argv.includes("--effects");
const provenance = onlyEffects ? JSON.parse(await readFile(path.join(output, "provenance.json"), "utf8")).assets.filter((asset) => asset.kind !== "effects") : [];
const hash = (data) => createHash("sha256").update(data).digest("hex");
await mkdir(path.join(output, "music"), { recursive: true });
await mkdir(path.join(output, "effects"), { recursive: true });
for (const [kind, items] of [["music", catalog.music], ["effects", catalog.effects]]) {
  if (onlyEffects && kind !== "effects") continue;
  for (const item of items) {
    const url = kind === "music" ? `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(item.sourceFile)}` : item.download;
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok || !/audio|octet-stream/.test(response.headers.get("content-type") ?? "")) throw new Error(`Audio download failed: ${item.id} (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const source = path.join(temporary, `${item.id}.mp3`);
    const target = path.join(output, kind, `${item.id}.mp3`);
    await writeFile(source, bytes);
    const trim = kind === "effects" ? ["-ss", String(item.start), "-t", String(item.seconds)] : [];
    const fades = kind === "effects" ? `,afade=t=in:d=0.008,afade=t=out:st=${Math.max(0, item.seconds - item.fadeOut)}:d=${item.fadeOut}` : "";
    const filter = `loudnorm=I=${kind === "music" ? -20 : -18}:TP=-2:LRA=9${fades}`;
    const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...trim, "-i", source, "-vn", "-map_metadata", "-1", "-af", filter, "-ar", "44100", "-ac", "2", "-codec:a", "libmp3lame", "-b:a", kind === "music" ? "160k" : "192k", target], { encoding: "utf8", windowsHide: true });
    if (result.status !== 0) throw new Error(result.stderr || `ffmpeg failed: ${item.id}`);
    const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", target], { encoding: "utf8", windowsHide: true });
    if (probe.status !== 0) throw new Error(`Could not verify ${item.id}`);
    const rendered = await readFile(target);
    provenance.push({ id: item.id, kind, source: url, sourceSha256: hash(bytes), file: `${kind}/${item.id}.mp3`, sha256: hash(rendered), bytes: rendered.length, durationSeconds: Number(JSON.parse(probe.stdout).format.duration), licence: kind === "music" ? "CC-BY-4.0" : "CC0-1.0", modifications: kind === "music" ? "Loudness normalised; re-encoded to 160 kbps MP3." : `Trimmed to ${item.seconds}s, edge fades, loudness normalised; re-encoded to MP3.` });
    console.log(`Prepared ${kind}: ${item.title}`);
  }
}
await writeFile(path.join(output, "provenance.json"), `${JSON.stringify({ checkedAt: new Date().toISOString().slice(0, 10), assets: provenance }, null, 2)}\n`);
console.log(`Verified ${provenance.length} bundled audio files. Sources retained in ${temporary}`);
