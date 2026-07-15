import { callerSnapshotSchema } from "@/lib/schemas";

export type BroadcastSnapshot = {
  showId: string;
  title: string;
  broadcastState: string;
  updatedAt: string;
  caller: null | {
    name: string;
    location: string;
    occupation?: string;
    issueHeadline: string;
    openingSummary: string;
    portraitUrl?: string;
    visual?: { label: string; url: string; creditText?: string; creditUrl?: string };
  };
};

export function publicCallerFromSnapshot(rawSnapshot: unknown, activeAssetId?: string | null): BroadcastSnapshot["caller"] {
  const snapshot = callerSnapshotSchema.parse(rawSnapshot);
  const portrait = snapshot.assets.find((asset) => asset.type === "PORTRAIT");
  const supportingVisual = activeAssetId ? snapshot.assets.find((asset) => asset.id === activeAssetId && asset.type === "SUPPORTING_VISUAL") : undefined;
  const surname = snapshot.publicIdentity.surnameInitial ? ` ${snapshot.publicIdentity.surnameInitial}` : "";

  return {
    name: `${snapshot.publicIdentity.firstName}${surname}`,
    location: snapshot.publicIdentity.location,
    ...(snapshot.publicIdentity.occupation ? { occupation: snapshot.publicIdentity.occupation } : {}),
    issueHeadline: snapshot.publicPremise.issueHeadline,
    openingSummary: snapshot.publicPremise.openingSummary,
    ...(portrait ? { portraitUrl: portrait.url } : {}),
    ...(supportingVisual ? { visual: {
      label: supportingVisual.label,
      url: supportingVisual.url,
      ...(supportingVisual.creditText ? { creditText: supportingVisual.creditText } : {}),
      ...(supportingVisual.creditUrl ? { creditUrl: supportingVisual.creditUrl } : {}),
    } } : {}),
  };
}
