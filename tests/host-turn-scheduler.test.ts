import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HostTurnScheduler } from "@/lib/host-turn-scheduler";

describe("AI presenter turn scheduling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("can reschedule a turn interrupted by renewed caller speech", () => {
    const scheduler = new HostTurnScheduler(); const run = vi.fn();
    scheduler.schedule("caller:1", run);
    vi.advanceTimersByTime(500); scheduler.cancel();
    scheduler.schedule("caller:1", run); vi.advanceTimersByTime(900);
    expect(run).toHaveBeenCalledOnce();
    scheduler.schedule("caller:1", run); vi.advanceTimersByTime(900);
    expect(run).toHaveBeenCalledOnce();
  });
  it("survives visual/SSE refreshes without losing or delaying the host turn", () => {
    const scheduler = new HostTurnScheduler(); const stale = vi.fn(); const fresh = vi.fn();
    scheduler.schedule("caller:1", stale); vi.advanceTimersByTime(500);
    scheduler.schedule("caller:1", fresh); vi.advanceTimersByTime(400);
    expect(stale).not.toHaveBeenCalled(); expect(fresh).toHaveBeenCalledOnce();
  });
  it("cancels on takeover, and resets cleanly for a new caller", () => {
    const scheduler = new HostTurnScheduler(); const run = vi.fn();
    scheduler.schedule("caller:1", run); scheduler.cancel(); vi.advanceTimersByTime(2000);
    expect(run).not.toHaveBeenCalled();
    scheduler.schedule("caller:2", run); vi.advanceTimersByTime(900); scheduler.reset();
    scheduler.schedule("caller:2", run); vi.advanceTimersByTime(900);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
