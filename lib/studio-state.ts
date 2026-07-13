import { prisma } from "@/lib/prisma";

export type StudioCaller = {
  id: string;
  name: string;
  age?: number | null;
  location: string;
  occupation?: string | null;
  issueHeadline: string;
  openingSummary: string;
  character: Record<string, unknown>;
  story: Record<string, unknown>;
  performance: Record<string, unknown>;
  hostSupport: Record<string, unknown>;
  assets: { id: string; type: string; label: string; url: string; trigger?: string | null; manualHotkey?: string | null }[];
};

export type StudioState = {
  caller: StudioCaller | null;
  queue: { id: string; position: number; name: string; issue: string; status: string }[];
  events: { type: string; timestamp: string; payload: Record<string, unknown> }[];
  soundEffects: { id: string; label: string; url: string; hotkey?: string | null; volume: number; loop: boolean }[];
};

const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function getStudioState(showId: string): Promise<StudioState> {
  const show = await prisma.show.findUniqueOrThrow({
    where: { id: showId },
    include: {
      queueItems: { include: { caller: { include: { assets: true } } }, orderBy: { position: "asc" } },
      events: { take: 30, orderBy: { timestamp: "desc" } },
      soundEffects: { orderBy: { createdAt: "asc" } },
    },
  });
  const current = show.queueItems.find((item) => item.id === show.currentQueueItemId) ?? null;
  return {
    caller: current ? {
      id: current.caller.id,
      name: `${current.caller.firstName}${current.caller.surnameInitial ? ` ${current.caller.surnameInitial}` : ""}`,
      age: current.caller.age,
      location: current.caller.location,
      occupation: current.caller.occupation,
      issueHeadline: current.caller.issueHeadline,
      openingSummary: current.caller.openingSummary,
      character: object(current.caller.character),
      story: object(current.caller.story),
      performance: object(current.caller.performance),
      hostSupport: object(current.caller.hostSupport),
      assets: current.caller.assets.map((asset) => ({ id: asset.id, type: asset.type, label: asset.label, url: asset.url, trigger: asset.trigger, manualHotkey: asset.manualHotkey })),
    } : null,
    queue: show.queueItems.map((item) => ({
      id: item.id,
      position: item.position,
      name: `${item.caller.firstName}${item.caller.surnameInitial ? ` ${item.caller.surnameInitial}` : ""}`,
      issue: item.caller.issueHeadline,
      status: item.status,
    })),
    events: show.events.map((event) => ({ type: event.type, timestamp: event.timestamp.toISOString(), payload: object(event.payload) })),
    soundEffects: show.soundEffects.map((effect) => ({ id: effect.id, label: effect.label, url: effect.url, hotkey: effect.hotkey, volume: effect.volume, loop: effect.loop })),
  };
}
