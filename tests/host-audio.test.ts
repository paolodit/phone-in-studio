import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playHostAudio } from "@/lib/host-audio";
class FakeAudio {
  static latest: FakeAudio;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => {});
  pause = vi.fn();
  constructor() { FakeAudio.latest = this; }
}
describe("host speech playback lifecycle", () => {
  beforeEach(() => { vi.stubGlobal("Audio", FakeAudio); vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:host-test"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it("waits until the host finishes before handing back to the caller", async () => {
    const done = vi.fn(); const promise = playHostAudio(new Blob(), new AbortController().signal).then(done);
    await Promise.resolve(); expect(done).not.toHaveBeenCalled();
    FakeAudio.latest.onended?.(); await promise;
    expect(done).toHaveBeenCalledOnce(); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:host-test");
  });
  it("stops audio and releases resources on takeover", async () => {
    const abort = new AbortController(); const promise = playHostAudio(new Blob(), abort.signal);
    abort.abort(); await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeAudio.latest.pause).toHaveBeenCalled(); expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it("cannot start late audio after Stop was pressed", async () => {
    const abort = new AbortController(); abort.abort();
    await expect(playHostAudio(new Blob(), abort.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
