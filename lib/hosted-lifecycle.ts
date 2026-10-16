import { after } from "next/server";
import { hostedMode } from "./hosted-platform";
import { IdleGuard } from "./idle-guard";
import { fileIdleState } from "./idle-state";
import path from "node:path";

const shared = globalThis as unknown as { hostedIdleGuard?: IdleGuard };
export const idleGuard = shared.hostedIdleGuard ??= new IdleGuard(Date.now,
  hostedSleepEnabled() ? fileIdleState(path.join(process.cwd(), "data", "hosted-sleep.json")) : undefined);
export function hostedSleepEnabled() {
  return hostedMode() && process.env.HOSTED_SLEEP_ENABLED === "true";
}
export function hostedIdleMs() {
  const seconds = Number(process.env.STUDIO_IDLE_SECONDS || 900);
  if (!Number.isInteger(seconds) || seconds < 60 || seconds > 86400)
    throw new Error("Invalid studio idle interval.");
  return seconds * 1000;
}
export function holdHostedRequest() {
  if (!hostedSleepEnabled()) return true;
  const release = idleGuard.enter();
  if (!release) return false;
  try { after(release); } catch (error) { release(); throw error; }
  return true;
}
export function holdHostedStream() {
  return hostedSleepEnabled() ? idleGuard.enter() : () => {};
}
