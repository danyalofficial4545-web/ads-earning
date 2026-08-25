import { describe, expect, it } from "vitest";
import {
  cappedAviatorPayout,
  chooseGenericGameOutcome,
  chooseCrashMultiplierX100,
  crashBands,
  crashTimeFor,
  createMiningState,
  EURO_DEFAULT_CRASH_WEIGHTS,
  maxDailyGameProfit,
  miningMultiplierX100,
  multiplierAt,
  parseCrashBandWeights,
  validateGenericGameSelection,
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

describe("Euro game-suite rules", () => {
  it("uses the requested Wheel distribution and preserves the 1.10x–100x Plinko bands", () => {
    expect(chooseGenericGameOutcome({ gameKey: "wheel", randomPercent: 0 }).multiplierX100).toBe(0);
    expect(chooseGenericGameOutcome({ gameKey: "wheel", randomPercent: 15 }).multiplierX100).toBe(150);
    expect(chooseGenericGameOutcome({ gameKey: "wheel", randomPercent: 55 }).multiplierX100).toBe(200);
    expect(chooseGenericGameOutcome({ gameKey: "wheel", randomPercent: 85 }).multiplierX100).toBe(500);
    expect(chooseGenericGameOutcome({ gameKey: "wheel", randomPercent: 95 }).multiplierX100).toBe(1000);
    expect(chooseGenericGameOutcome({ gameKey: "wheel", randomPercent: 99 }).multiplierX100).toBe(5000);
    expect(chooseGenericGameOutcome({ gameKey: "plinko", randomPercent: 95, randomInteger: () => 0 }).multiplierX100).toBe(5001);
  });

  it("only produces a wins for correct Ludo, Color, and Lucky Number selections", () => {
    expect(chooseGenericGameOutcome({ gameKey: "ludo", selection: "3", randomInteger: () => 2 }).multiplierX100).toBe(500);
    expect(chooseGenericGameOutcome({ gameKey: "ludo", selection: "3", randomInteger: () => 1 }).multiplierX100).toBe(0);
    expect(chooseGenericGameOutcome({ gameKey: "color", selection: "red", randomPercent: 47 }).multiplierX100).toBe(190);
    expect(chooseGenericGameOutcome({ gameKey: "color", selection: "red", randomPercent: 48 }).multiplierX100).toBe(0);
    expect(chooseGenericGameOutcome({ gameKey: "lucky", selection: "7", randomInteger: () => 7 }).multiplierX100).toBe(900);
    expect(chooseGenericGameOutcome({ gameKey: "lucky", selection: "7", randomInteger: () => 3 }).multiplierX100).toBe(0);
  });

  it("creates exactly five unique private Mining bombs and increments only safe-tile cash-out value", () => {
    const sequence = [0, 0, 5, 6, 6, 13, 24];
    const state = createMiningState(() => sequence.shift() ?? 1);
    expect(state.bombs).toEqual([0, 5, 6, 13, 24]);
    expect(state.bombs).toHaveLength(5);
    expect(miningMultiplierX100(0)).toBe(100);
    expect(miningMultiplierX100(1)).toBe(130);
    expect(miningMultiplierX100(4)).toBe(220);
  });

  it("rejects missing game choices before a stake can be settled", () => {
    expect(validateGenericGameSelection("ludo", "")).toContain("1 to 6");
    expect(validateGenericGameSelection("color", "blue")).toContain("Red or Green");
    expect(validateGenericGameSelection("lucky", "10")).toContain("0 to 9");
    expect(validateGenericGameSelection("slots", undefined)).toBeNull();
  });
});
