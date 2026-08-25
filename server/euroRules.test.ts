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
  moveLudoToken,
  parseCrashBandWeights,
  sharedColorState,
  sharedCrashMultiplierX100,
  sharedCrashState,
  sharedLuckyState,
  sharedRoundKey,
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

  it("uses Fortune Gems loss, small-win, medium-win, and jackpot outcome bands", () => {
    expect(chooseGenericGameOutcome({ gameKey: "slots", randomPercent: 0 }).multiplierX100).toBe(0);
    expect(chooseGenericGameOutcome({ gameKey: "slots", randomPercent: 30, randomInteger: () => 0 }).multiplierX100).toBe(150);
    expect(chooseGenericGameOutcome({ gameKey: "slots", randomPercent: 90, randomInteger: () => 0 }).multiplierX100).toBe(500);
    const jackpot = chooseGenericGameOutcome({ gameKey: "slots", randomPercent: 97, randomInteger: () => 0 });
    expect(jackpot.multiplierX100).toBe(1500);
    expect(jackpot.publicState.reels).toEqual(Array(9).fill("💎"));
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

describe("timestamp-seeded shared Euro rounds", () => {
  const now = new Date("2026-08-25T00:00:07.000Z");

  it("gives every request in one UTC bucket the same shared crash outcome", () => {
    const sameBucket = new Date("2026-08-25T00:00:07.900Z");
    const key = sharedRoundKey("aviator", now);
    expect(key).toBe(sharedRoundKey("aviator", sameBucket));
    expect(sharedCrashMultiplierX100(key, "70,10,10,10")).toBe(sharedCrashMultiplierX100(key, "70,10,10,10"));
    const state = sharedCrashState("aviator", now, "70,10,10,10");
    expect(state.phase).toBe("flying");
    expect(state.crashMultiplierX100).toBeGreaterThanOrEqual(100);
    expect(state.crashMultiplierX100).toBeLessThanOrEqual(20000);
  });

  it("derives common Color and Lucky results from the same timestamp bucket", () => {
    expect(sharedColorState(now).result).toBe(sharedColorState(new Date("2026-08-25T00:00:07.500Z")).result);
    expect(sharedLuckyState(now).result).toBe(sharedLuckyState(new Date("2026-08-25T00:00:07.500Z")).result);
    expect(["red", "green", "tie"]).toContain(sharedColorState(now).result);
    expect(sharedLuckyState(now).result).toBeGreaterThanOrEqual(0);
    expect(sharedLuckyState(now).result).toBeLessThanOrEqual(9);
  });

  it("keeps Ludo token movement server-controlled and requires six to leave home", () => {
    const board = { rolls: [], playerOneTokens: [-1, -1, -1, -1], playerTwoTokens: [-1, -1, -1, -1], turn: "one" as const, turnNumber: 0 };
    expect(moveLudoToken({ board, side: "one", tokenIndex: 0, roll: 2 }).moved).toBe(false);
    const started = moveLudoToken({ board, side: "one", tokenIndex: 0, roll: 6 });
    expect(started.moved).toBe(true);
    expect(started.board.playerOneTokens[0]).toBe(0);
  });
});
