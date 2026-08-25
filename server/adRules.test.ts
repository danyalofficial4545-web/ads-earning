import { describe, expect, it } from "vitest";
import {
  getDailyAdRewardPkr,
  getDailyAdQuota,
  getDailyAdStates,
  getNextPakistanMidnight,
  getPakistanDayKey,
  getPakistanResetSeconds,
} from "../shared/adRules";

describe("Pakistan daily ad rules", () => {
  it("maps the eight package prices to the required daily rewarded-ad quotas and rewards", () => {
    const prices = [100, 200, 300, 400, 500, 1000, 2000, 5000];
    expect(prices.map(getDailyAdQuota)).toEqual([1, 2, 2, 2, 3, 4, 5, 5]);
    expect(prices.map(getDailyAdRewardPkr)).toEqual([30, 30, 40, 60, 70, 80, 100, 200]);
  });

  it("uses Pakistan midnight rather than UTC midnight for the daily reset", () => {
    const beforeMidnight = new Date("2026-08-15T18:59:45.000Z");
    expect(getPakistanDayKey(beforeMidnight)).toBe("2026-08-15");
    expect(getNextPakistanMidnight(beforeMidnight).toISOString()).toBe(
      "2026-08-15T19:00:00.000Z"
    );
    expect(getPakistanResetSeconds(beforeMidnight)).toBe(15);
  });

  it("keeps the generic state helper available for protected sequential slots", () => {
    expect(getDailyAdStates([1, 2, 3, 4], 2, new Set([1]))).toEqual([
      { id: 1, state: "watched" },
      { id: 2, state: "unlocked" },
      { id: 3, state: "locked" },
      { id: 4, state: "locked" },
    ]);
  });
});
