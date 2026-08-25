import { describe, expect, it } from "vitest";
import {
  cappedAviatorPayout,
  chooseCrashMultiplierX100,
  crashBands,
  crashTimeFor,
  EURO_DEFAULT_CRASH_WEIGHTS,
  maxDailyGameProfit,
  multiplierAt,
  parseCrashBandWeights,
  validateEuroBetAmount,
} from "./euroRules";

describe("Euro Aviator rules", () => {
  it("uses five non-overlapping crash bands totaling 100 percent", () => {
    expect(parseCrashBandWeights(EURO_DEFAULT_CRASH_WEIGHTS)).toEqual([50, 30, 10, 5, 5]);
    expect(crashBands()).toEqual([
      { minX100: 110, maxX100: 150, weight: 50 },
      { minX100: 151, maxX100: 500, weight: 30 },
      { minX100: 501, maxX100: 2000, weight: 10 },
      { minX100: 2001, maxX100: 5000, weight: 5 },
      { minX100: 5001, maxX100: 10000, weight: 5 },
    ]);
  });

  it("selects values only from the selected non-overlapping crash band", () => {
    expect(chooseCrashMultiplierX100(undefined, 0, () => 0)).toBe(110);
    expect(chooseCrashMultiplierX100(undefined, 50, () => 0)).toBe(151);
    expect(chooseCrashMultiplierX100(undefined, 80, () => 0)).toBe(501);
    expect(chooseCrashMultiplierX100(undefined, 90, () => 0)).toBe(2001);
    expect(chooseCrashMultiplierX100(undefined, 95, () => 0)).toBe(5001);
  });

  it("enforces exact Aviator bet bounds and package-based daily profit caps", () => {
    expect(validateEuroBetAmount(15)).toContain("Minimum Aviator bet is 16");
    expect(validateEuroBetAmount(16)).toBeNull();
    expect(validateEuroBetAmount(20_001)).toContain("Maximum Aviator bet is 20,000");
    expect(maxDailyGameProfit(500)).toBe(1500);
    expect(cappedAviatorPayout({ stakePkr: 100, multiplierX100: 500, priorProfitPkr: 1450, dailyProfitLimitPkr: 1500 })).toEqual({ payoutPkr: 150, profitPkr: 50 });
  });

  it("uses server timestamps for the multiplier and crash boundary", () => {
    const startsAt = new Date("2026-08-25T00:00:00.000Z");
    const crashAt = crashTimeFor(startsAt, 200);
    expect(multiplierAt(startsAt, startsAt)).toBe(100);
    expect(multiplierAt(crashAt, startsAt)).toBeGreaterThanOrEqual(200);
  });
});
