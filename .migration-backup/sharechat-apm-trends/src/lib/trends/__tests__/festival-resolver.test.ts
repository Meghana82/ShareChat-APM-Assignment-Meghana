import { describe, expect, it } from "vitest";
import { getActiveFestivalSignals } from "../festival-resolver";

describe("festival resolver", () => {
  it("returns Vat Savitri and Shani Amavasya on 2026-05-16", () => {
    const signals = getActiveFestivalSignals(new Date("2026-05-16T10:00:00+05:30"));
    const titles = signals.map((signal) => signal.rawTitle).join(" ");
    expect(titles).toContain("वट सावित्री");
    expect(titles).toContain("शनि अमावस्या");
    expect(signals.some((signal) => signal.metadata?.isFestivalToday === true)).toBe(true);
  });

  it("does not return inactive Sawan Somwar on 2026-05-16", () => {
    const signals = getActiveFestivalSignals(new Date("2026-05-16T10:00:00+05:30"));
    expect(signals.map((signal) => signal.rawTitle).join(" ")).not.toContain("सावन सोमवार");
  });
});
