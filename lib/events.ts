import { EventEmitter } from "node:events";
import type { BroadcastSnapshot } from "@/lib/public-show";

export type BroadcastAudioLevels = {
  bands: number[];
  level: number;
};

type Bus = EventEmitter;
const globalForEvents = globalThis as unknown as { showEventBus?: Bus };
const bus = globalForEvents.showEventBus ?? new EventEmitter();
bus.setMaxListeners(100);
if (!globalForEvents.showEventBus) globalForEvents.showEventBus = bus;

export function publishShowUpdate(showId: string, snapshot: BroadcastSnapshot) {
  bus.emit(`show:${showId}`, snapshot);
}

export function subscribeToShow(showId: string, listener: (snapshot: BroadcastSnapshot) => void) {
  const event = `show:${showId}`;
  bus.on(event, listener);
  return () => bus.off(event, listener);
}

export function publishShowAudioLevels(showId: string, levels: BroadcastAudioLevels) {
  bus.emit(`show-audio:${showId}`, levels);
}

export function subscribeToShowAudioLevels(showId: string, listener: (levels: BroadcastAudioLevels) => void) {
  const event = `show-audio:${showId}`;
  bus.on(event, listener);
  return () => bus.off(event, listener);
}
