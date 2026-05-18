import { describe, expect, it } from "vitest";
import { getDailyRhythmSignals } from "../daily-rhythm";
import { normalizeSignal } from "../normalize";
import { computeIndiaHindiRelevanceScore } from "../relevance";

describe("daily rhythm signals", () => {
  it("Sunday morning returns Shubh Ravivar and Suprabhat", () => {
    const signals = getDailyRhythmSignals(new Date("2026-05-17T07:30:00+05:30"));
    const text = signals.map((signal) => signal.rawTitle).join(" ");
    expect(text).toContain("#शुभ_रविवार");
    expect(text).toContain("#सुप्रभात_संदेश");
  });

  it("May 17 returns World Telecommunication Day and summer rescue", () => {
    const signals = getDailyRhythmSignals(new Date("2026-05-17T09:00:00+05:30"));
    const text = signals.map((signal) => signal.rawTitle).join(" ");
    expect(text).toContain("#विश्व_दूरसंचार_दिवस");
    expect(text).toContain("#गर्मी_से_बचाव");
    expect(text).toContain("#माँ_वैष्णो_देवी");
    expect(text).not.toContain("#हनुमान_भक्ति");
  });

  it("daily rhythm gets Bharat relevance floor", () => {
    const signal = getDailyRhythmSignals(new Date("2026-05-17T07:30:00+05:30"))[0];
    const normalized = normalizeSignal(signal);
    expect(computeIndiaHindiRelevanceScore(signal, normalized, signal.categoryHint ?? "viral")).toBeGreaterThanOrEqual(85);
  });
});
