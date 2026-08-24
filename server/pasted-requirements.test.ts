import { describe, expect, it } from "vitest";
import {
  DEPOSIT_MAX_PKR,
  DEPOSIT_MIN_PKR,
  WITHDRAWAL_MAX_PKR,
  WITHDRAWAL_ZERO_LIMIT_MESSAGE,
  validateDepositAmountPkr,
  validateWithdrawalRequest,
} from "./rules";

describe("pasted requirements rules", () => {
  it("accepts only deposits from 100 to 5000 PKR", () => {
    expect(validateDepositAmountPkr(DEPOSIT_MIN_PKR)).toBeNull();
    expect(validateDepositAmountPkr(DEPOSIT_MAX_PKR)).toBeNull();
    expect(validateDepositAmountPkr(DEPOSIT_MIN_PKR - 1)).toContain("100 PKR");
    expect(validateDepositAmountPkr(DEPOSIT_MAX_PKR + 1)).toContain("5000 PKR");
  });

  it("allows the joined-channel reward amount and reports the current specific limit reason", () => {
    const base = { balancePkr: WITHDRAWAL_MAX_PKR, amountPkr: 10 };
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 0, activePackage: true })).toBe(WITHDRAWAL_ZERO_LIMIT_MESSAGE);
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 10, allowChannelRewardAmount: true })).toBeNull();
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: WITHDRAWAL_MAX_PKR, amountPkr: WITHDRAWAL_MAX_PKR + 1 })).toContain("Maximum withdrawal is 3000 PKR");
  });

  it("shows the specific zero-limit reason consistently before and after package activation", () => {
    const base = { balancePkr: 3000, amountPkr: 10 };
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 0, activePackage: false })).toBe(WITHDRAWAL_ZERO_LIMIT_MESSAGE);
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 0, activePackage: true })).toBe(WITHDRAWAL_ZERO_LIMIT_MESSAGE);
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 10, activePackage: true, allowChannelRewardAmount: true })).toBeNull();
  });
});
