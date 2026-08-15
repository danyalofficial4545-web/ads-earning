import { describe, expect, it } from "vitest";
import {
  getDailyAdQuota,
  getDailyAdStates,
  getNextPakistanMidnight,
  getPakistanDayKey,
  getPakistanResetSeconds,
} from "../shared/adRules";

describe("Pakistan daily ad rules", () => {
  it("maps the six package prices to the required daily ad quotas", () => {
    expect([100, 200, 500, 1000, 2000, 5000].map(getDailyAdQuota)).toEqual([
      1, 2, 5, 10, 20, 50,
    ]);
  });

  it("uses Pakistan midnight rather than UTC midnight for the daily reset", () => {
    const beforeMidnight = new Date("2026-08-15T18:59:45.000Z");
    expect(getPakistanDayKey(beforeMidnight)).toBe("2026-08-15");
    expect(getNextPakistanMidnight(beforeMidnight).toISOString()).toBe(
      "2026-08-15T19:00:00.000Z"
    );
    expect(getPakistanResetSeconds(beforeMidnight)).toBe(15);
  });

  it("keeps every custom ad visible while only the package quota is unlocked", () => {
    expect(getDailyAdStates([1, 2, 3, 4], 2, new Set([1]))).toEqual([
      { id: 1, state: "watched" },
      { id: 2, state: "unlocked" },
      { id: 3, state: "locked" },
      { id: 4, state: "locked" },
    ]);
  });
});
