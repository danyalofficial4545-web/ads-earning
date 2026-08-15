import { describe, expect, it } from "vitest";
import {
  DEPOSIT_MAX_PKR,
  DEPOSIT_MIN_PKR,
  WITHDRAWAL_MAX_PKR,
  WITHDRAWAL_MIN_PKR,
  WITHDRAWAL_LOCK_MESSAGE,
  validateDepositAmountPkr,
  validateWithdrawalRequest,
} from "./rules";

describe("pasted requirements rules", () => {
  it("accepts only deposits from 100 to 1000 PKR", () => {
    expect(validateDepositAmountPkr(DEPOSIT_MIN_PKR)).toBeNull();
    expect(validateDepositAmountPkr(DEPOSIT_MAX_PKR)).toBeNull();
    expect(validateDepositAmountPkr(DEPOSIT_MIN_PKR - 1)).toContain("100 PKR");
    expect(validateDepositAmountPkr(DEPOSIT_MAX_PKR + 1)).toContain("1000 PKR");
  });

  it("uses the 50 to 3000 PKR withdrawal range and unlock threshold", () => {
    const base = { balancePkr: 3000, amountPkr: 50, minimumWithdrawalPkr: WITHDRAWAL_MIN_PKR, maximumWithdrawalPkr: WITHDRAWAL_MAX_PKR };
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 49, activePackage: true })).toBe(WITHDRAWAL_LOCK_MESSAGE);
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 50, activePackage: true })).toBeNull();
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 3000, amountPkr: 49 })).toContain("PKR 50");
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 3000, amountPkr: 3001 })).toContain("PKR 3000");
  });

  it("shows the invite message only after package activation", () => {
    const base = { balancePkr: 3000, amountPkr: 50, minimumWithdrawalPkr: WITHDRAWAL_MIN_PKR, maximumWithdrawalPkr: WITHDRAWAL_MAX_PKR };
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 0, activePackage: false })).not.toBe(WITHDRAWAL_LOCK_MESSAGE);
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 0, activePackage: true })).toBe(WITHDRAWAL_LOCK_MESSAGE);
    expect(validateWithdrawalRequest({ ...base, withdrawalLimitPkr: 50, activePackage: true })).toBeNull();
  });
});
