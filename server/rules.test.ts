import { describe, expect, it } from "vitest";
import {
  AD_TIMER_MESSAGE,
  canUseMemberWorkspace,
  canClaimAd,
  fromPkr,
  isDesignatedAdministrator,
  matchesRequestTransaction,
  referralLimitCredit,
  toPkr,
  validateWithdrawalRequest,
  WITHDRAWAL_LOCK_MESSAGE,
} from "./rules";

describe("Package Earn Pro server rules", () => {
  it("converts wallet amounts against the configured PKR–USD rate", () => {
    expect(toPkr(2.5, "USD", 280)).toBe(700);
    expect(toPkr(350, "PKR", 280)).toBe(350);
    expect(fromPkr(700, 280)).toBe(2.5);
  });

  it("credits referral value only to the withdrawal limit according to the configured percentage", () => {
    expect(referralLimitCredit(300, 50)).toBe(150);
    expect(referralLimitCredit(1000, 25)).toBe(250);
  });

  it("enforces the exact referral-based withdrawal lock message", () => {
    expect(validateWithdrawalRequest({ balancePkr: 1000, withdrawalLimitPkr: 0, amountPkr: 100, minimumWithdrawalPkr: 100, maximumWithdrawalPkr: 3000 })).toBe(WITHDRAWAL_LOCK_MESSAGE);
  });

  it("rejects withdrawal amounts outside of limits or the available balance", () => {
    expect(validateWithdrawalRequest({ balancePkr: 1000, withdrawalLimitPkr: 500, amountPkr: 50, minimumWithdrawalPkr: 100, maximumWithdrawalPkr: 3000 })).toContain("between PKR 100 and PKR 3000");
    expect(validateWithdrawalRequest({ balancePkr: 1000, withdrawalLimitPkr: 500, amountPkr: 600, minimumWithdrawalPkr: 100, maximumWithdrawalPkr: 3000 })).toContain("current withdrawal limit");
    expect(validateWithdrawalRequest({ balancePkr: 150, withdrawalLimitPkr: 500, amountPkr: 200, minimumWithdrawalPkr: 100, maximumWithdrawalPkr: 3000 })).toContain("wallet balance is insufficient");
  });

  it("allows a reward only after the whole server-side timer duration has elapsed", () => {
    const startedAt = new Date("2026-08-14T12:00:00.000Z");
    expect(canClaimAd(startedAt, new Date("2026-08-14T12:00:29.999Z"), 30)).toBe(false);
    expect(canClaimAd(startedAt, new Date("2026-08-14T12:00:30.000Z"), 30)).toBe(true);
    expect(AD_TIMER_MESSAGE).toContain("30 seconds");
  });

  it("grants administrator capability only to the exact designated identity and denies blocked members", () => {
    expect(isDesignatedAdministrator("muhammaddanyal4545@gmail.com", "danyal955163")).toBe(true);
    expect(isDesignatedAdministrator("other@example.com", "danyal955163")).toBe(false);
    expect(isDesignatedAdministrator("muhammaddanyal4545@gmail.com", "other_user")).toBe(false);
    expect(canUseMemberWorkspace(false)).toBe(true);
    expect(canUseMemberWorkspace(true)).toBe(false);
  });

  it("matches financial status updates only to the transaction that owns a specific request", () => {
    expect(matchesRequestTransaction("deposit", 12, "deposit", 12)).toBe(true);
    expect(matchesRequestTransaction("deposit", 13, "deposit", 12)).toBe(false);
    expect(matchesRequestTransaction("withdrawal", 12, "deposit", 12)).toBe(false);
  });
});
