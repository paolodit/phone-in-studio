import { showArtworkUrl, type ShowIdentity } from "@/lib/show-identity";

export function ChannelArtwork({ title, identity, compact = false, className = "", decorative = false }: { title: string; identity: ShowIdentity; compact?: boolean; className?: string; decorative?: boolean }) {
  return <img src={showArtworkUrl(title, identity, compact)} alt={decorative ? "" : `${title} channel artwork`} width={compact ? 120 : 1024} height={compact ? 120 : 640} className={`${compact ? "aspect-square" : "aspect-[8/5]"} object-cover ${className}`} />;
}
