import { describe, expect, it } from "vitest";
import {
  calculateDepositorBonus,
  calculateInviterReward,
  DEPOSITOR_BONUS_RATE,
  INVITER_REWARD_RATE,
} from "./depositService";

describe("permanent deposit referral rates", () => {
  it("keeps the hardcoded business rates at 10% and 40%", () => {
    expect(DEPOSITOR_BONUS_RATE).toBe(0.1);
    expect(INVITER_REWARD_RATE).toBe(0.4);
  });

  it("calculates the depositor bonus", () => {
    expect(calculateDepositorBonus(400)).toBe(40);
    expect(calculateDepositorBonus(5000)).toBe(500);
  });

  it("calculates the inviter withdrawal reward", () => {
    expect(calculateInviterReward(400)).toBe(160);
    expect(calculateInviterReward(5000)).toBe(2000);
  });
});
