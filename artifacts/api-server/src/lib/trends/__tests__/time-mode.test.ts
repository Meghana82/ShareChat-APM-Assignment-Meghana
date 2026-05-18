import { describe, expect, it } from "vitest";
import { getTrendTimeMode } from "../time-mode";

describe("trend time mode", () => {
  it("08:00 IST returns early morning status mode", () => {
    const mode = getTrendTimeMode(new Date("2026-05-17T08:00:00+05:30"));
    expect(mode.mode).toBe("early_morning_status");
    expect(mode.dailyRhythmTop10Cap).toBe(4);
    expect(mode.dailyRhythmTop4Cap).toBe(3);
  });

  it("12:00 IST returns daytime live pulse mode", () => {
    const mode = getTrendTimeMode(new Date("2026-05-17T12:00:00+05:30"));
    expect(mode.mode).toBe("daytime_live_pulse");
    expect(mode.dailyRhythmTop10Cap).toBe(2);
    expect(mode.dailyRhythmTop4Cap).toBe(1);
  });

  it("19:00 IST returns evening entertainment sports mode", () => {
    expect(getTrendTimeMode(new Date("2026-05-17T19:00:00+05:30")).mode).toBe("evening_entertainment_sports");
  });
});
