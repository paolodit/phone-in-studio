import { describe, expect, it } from "vitest";
import { RecordingClock, recordingFilename, recordingTime } from "@/lib/recording-model";
describe("Recording time and exports", () => {
  it("excludes pauses and repeated pause/resume from marker time", () => {
    let now = 0; const clock = new RecordingClock(() => now);
    now = 5000; clock.pause(); now = 15000; clock.pause(); expect(clock.seconds()).toBe(5);
    clock.resume(); clock.resume(); now = 17000; expect(clock.seconds()).toBe(7);
  });
  it("formats safe times and filenames", () => {
    expect(recordingTime(65.9)).toBe("01:05"); expect(recordingTime(Number.NaN)).toBe("00:00");
    expect(recordingFilename("A / show: tonight?", "2026-09-10T12:30:00Z")).toBe("A  show tonight-2026-09-10-12-30-00");
  });
});
