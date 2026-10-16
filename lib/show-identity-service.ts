import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { showIdentitySchema } from "@/lib/show-identity";
import { artworkExists } from "@/lib/show-artwork-store";
import { getBroadcastSnapshot } from "@/lib/show-service";
import { publishShowUpdate } from "@/lib/events";

export async function saveShowIdentity(showId: string, input: unknown) {
  const identity = showIdentitySchema.parse(input);
  if (identity.artworkUrl && !await artworkExists(identity.artworkUrl)) throw new Error("Upload this image again before saving.");
  // Optimistic merge avoids overwriting music/autoplay changes from an open Studio.
  for (let attempt = 0; attempt < 3; attempt++) {
    const show = await prisma.show.findUniqueOrThrow({ where: { id: showId }, select: { brandingConfig: true, updatedAt: true } });
    const config = show.brandingConfig && typeof show.brandingConfig === "object" && !Array.isArray(show.brandingConfig) ? show.brandingConfig : {};
    const result = await prisma.show.updateMany({ where: { id: showId, updatedAt: show.updatedAt }, data: { brandingConfig: { ...config, identity } as Prisma.InputJsonValue } });
    if (result.count) { publishShowUpdate(showId, await getBroadcastSnapshot(showId)); return identity; }
  }
  throw new Error("The channel is being updated elsewhere. Please save again.");
}
