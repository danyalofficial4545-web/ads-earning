import { describe, expect, it } from "vitest";
import {
  AD_REWARD_PKR,
  AD_TIMER_MESSAGE,
  applyWithdrawalRequest,
  canUseMemberWorkspace,
  canClaimAd,
  getAdClaimStatus,
  fromPkr,
  isDesignatedAdministrator,
  matchesRequestTransaction,
  referralLimitCredit,
  refundRejectedWithdrawal,
  toPkr,
  validateWithdrawalRequest,
  WITHDRAWAL_LOCK_MESSAGE,
  WITHDRAWAL_MAX_MESSAGE,
  WITHDRAWAL_MAX_PKR,
  WHATSAPP_JOIN_REWARD_PKR,
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

  it("reserves the wallet amount and resets the one-time withdrawal limit at request time", () => {
    expect(applyWithdrawalRequest(1200, 500)).toEqual({
      balancePkr: 700,
      withdrawalLimitPkr: 0,
    });
    expect(refundRejectedWithdrawal(700, 500)).toBe(1200);
  });

  it("enforces the exact referral-based withdrawal lock message", () => {
    expect(
      validateWithdrawalRequest({
        balancePkr: 1000,
        withdrawalLimitPkr: 0,
        amountPkr: 100,
      })
    ).toBe(WITHDRAWAL_LOCK_MESSAGE);
  });

  it("allows the channel-reward withdrawal amount and rejects only amounts over the fixed maximum", () => {
    expect(
      validateWithdrawalRequest({
        balancePkr: WHATSAPP_JOIN_REWARD_PKR,
        withdrawalLimitPkr: WHATSAPP_JOIN_REWARD_PKR,
        amountPkr: WHATSAPP_JOIN_REWARD_PKR,
      })
    ).toBeNull();
    expect(
      validateWithdrawalRequest({
        balancePkr: WITHDRAWAL_MAX_PKR + 1,
        withdrawalLimitPkr: WITHDRAWAL_MAX_PKR + 1,
        amountPkr: WITHDRAWAL_MAX_PKR + 1,
      })
    ).toBe(WITHDRAWAL_MAX_MESSAGE);
    expect(
      validateWithdrawalRequest({
        balancePkr: 1000,
        withdrawalLimitPkr: 500,
        amountPkr: 600,
      })
    ).toContain("current withdrawal limit");
    expect(
      validateWithdrawalRequest({
        balancePkr: 150,
        withdrawalLimitPkr: 500,
        amountPkr: 200,
      })
    ).toContain("wallet balance is insufficient");
  });

  it("allows a reward only after the whole server-side timer duration has elapsed", () => {
    const startedAt = new Date("2026-08-14T12:00:00.000Z");
    expect(
      canClaimAd(startedAt, new Date("2026-08-14T12:00:09.999Z"), 10)
    ).toBe(false);
    expect(
      canClaimAd(startedAt, new Date("2026-08-14T12:00:10.000Z"), 10)
    ).toBe(true);
    expect(AD_TIMER_MESSAGE).toContain("10-second timer");
    expect(AD_REWARD_PKR).toBe(20);
  });

  it("permits a completed custom ad even when the external tab was closed before the timer completed", () => {
    const startedAt = new Date("2026-08-14T12:00:00.000Z");
    expect(
      getAdClaimStatus({
        startedAt,
        lastHeartbeatAt: new Date("2026-08-14T12:00:10.000Z"),
        invalidatedAt: null,
        now: new Date("2026-08-14T12:00:10.000Z"),
        timerSeconds: 10,
      })
    ).toBe("claimable");
    expect(
      getAdClaimStatus({
        startedAt,
        lastHeartbeatAt: new Date("2026-08-14T12:00:00.000Z"),
        invalidatedAt: null,
        now: new Date("2026-08-14T12:00:10.001Z"),
        timerSeconds: 10,
      })
    ).toBe("claimable");
    expect(
      getAdClaimStatus({
        startedAt,
        lastHeartbeatAt: new Date("2026-08-14T12:00:10.000Z"),
        invalidatedAt: new Date("2026-08-14T12:00:05.000Z"),
        now: new Date("2026-08-14T12:00:10.000Z"),
        timerSeconds: 10,
      })
    ).toBe("claimable");
  });

  it("grants administrator capability only to the exact designated identity and denies blocked members", () => {
    expect(
      isDesignatedAdministrator("muhammaddanyal4545@gmail.com", "danyal955163")
    ).toBe(true);
    expect(isDesignatedAdministrator("other@example.com", "danyal955163")).toBe(
      false
    );
    expect(
      isDesignatedAdministrator("muhammaddanyal4545@gmail.com", "other_user")
    ).toBe(false);
    expect(canUseMemberWorkspace(false)).toBe(true);
    expect(canUseMemberWorkspace(true)).toBe(false);
  });

  it("matches financial status updates only to the transaction that owns a specific request", () => {
    expect(matchesRequestTransaction("deposit", 12, "deposit", 12)).toBe(true);
    expect(matchesRequestTransaction("deposit", 13, "deposit", 12)).toBe(false);
    expect(matchesRequestTransaction("withdrawal", 12, "deposit", 12)).toBe(
      false
    );
  });
});
