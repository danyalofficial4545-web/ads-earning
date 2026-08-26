import { describe, expect, it } from "vitest";
import {
  AD_TIMER_MESSAGE,
  applyWithdrawalRequest,
  canUseMemberWorkspace,
  canClaimAd,
  getAdClaimStatus,
  fromPkr,
  isDesignatedAdministrator,
  isEligibleForNewUserWhatsappReward,
  isValidPakistanMobileNumber,
  matchesRequestTransaction,
  normalizePakistanMobileNumber,
  referralLimitCredit,
  refundRejectedWithdrawal,
  toPkr,
  validateWithdrawalRequest,
  WITHDRAWAL_FREE_REWARD_USED_MESSAGE,
  WITHDRAWAL_MINIMUM_MESSAGE,
  WITHDRAWAL_MAX_PKR,
  WITHDRAWAL_ZERO_LIMIT_MESSAGE,
  WHATSAPP_JOIN_REWARD_PKR,
  REWARDED_AD_TIMER_SECONDS,
} from "./rules";

describe("Package Earn Pro server rules", () => {
  it("converts wallet amounts against the configured PKR–USD rate", () => {
    expect(toPkr(2.5, "USD", 280)).toBe(700);
    expect(toPkr(350, "PKR", 280)).toBe(350);
    expect(fromPkr(700, 280)).toBe(2.5);
  });

  it("normalizes and validates Pakistani JazzCash or Easypaisa-style mobile numbers", () => {
    expect(normalizePakistanMobileNumber("+92 300 1234567")).toBe("03001234567");
    expect(isValidPakistanMobileNumber("03001234567")).toBe(true);
    expect(isValidPakistanMobileNumber("0123456789")).toBe(false);
  });

  it("allows the channel reward only for profiles created after the correction boundary", () => {
    expect(isEligibleForNewUserWhatsappReward(new Date("2026-08-23T15:59:59.999Z"))).toBe(false);
    expect(isEligibleForNewUserWhatsappReward(new Date("2026-08-23T16:00:00.000Z"))).toBe(true);
  });

  it("credits referral value only to the withdrawal limit according to the configured percentage", () => {
    expect(referralLimitCredit(300, 50)).toBe(150);
    expect(referralLimitCredit(1000, 25)).toBe(250);
  });

  it("reserves only the requested wallet amount and withdrawal-limit amount", () => {
    expect(applyWithdrawalRequest(6000, 5000, 100)).toEqual({
      balancePkr: 5900,
      withdrawalLimitPkr: 4900,
    });
    expect(applyWithdrawalRequest(1200, 500, 500)).toEqual({
      balancePkr: 700,
      withdrawalLimitPkr: 0,
    });
    expect(refundRejectedWithdrawal(700, 500)).toBe(1200);
  });

  it("shows the exact zero-limit withdrawal reason before lower-priority amount checks", () => {
    expect(
      validateWithdrawalRequest({
        balancePkr: 1000,
        withdrawalLimitPkr: 0,
        amountPkr: 100,
      })
    ).toBe(WITHDRAWAL_ZERO_LIMIT_MESSAGE);
  });

  it("allows the channel-reward withdrawal amount and returns exact minimum, maximum-or-limit, and wallet-balance messages", () => {
    expect(
      validateWithdrawalRequest({
        balancePkr: WHATSAPP_JOIN_REWARD_PKR,
        withdrawalLimitPkr: WHATSAPP_JOIN_REWARD_PKR,
        amountPkr: WHATSAPP_JOIN_REWARD_PKR,
        allowChannelRewardAmount: true,
      })
    ).toBeNull();
    expect(
      validateWithdrawalRequest({
        balancePkr: WITHDRAWAL_MAX_PKR + 1,
        withdrawalLimitPkr: WITHDRAWAL_MAX_PKR + 1,
        amountPkr: WITHDRAWAL_MAX_PKR + 1,
      })
    ).toContain("Maximum withdrawal is 3000 PKR");
    expect(
      validateWithdrawalRequest({
        balancePkr: 1000,
        withdrawalLimitPkr: 500,
        amountPkr: 600,
      })
    ).toContain("your limit is PKR 500");
    expect(
      validateWithdrawalRequest({
        balancePkr: 1000,
        withdrawalLimitPkr: 500,
        amountPkr: 20,
      })
    ).toBe(WITHDRAWAL_MINIMUM_MESSAGE);
    expect(
      validateWithdrawalRequest({
        balancePkr: 0,
        withdrawalLimitPkr: 500,
        amountPkr: 100,
        activePackage: false,
        freeWithdrawalCompleted: true,
      })
    ).toBe(WITHDRAWAL_FREE_REWARD_USED_MESSAGE);
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
      canClaimAd(startedAt, new Date("2026-08-14T12:00:04.999Z"), REWARDED_AD_TIMER_SECONDS)
    ).toBe(false);
    expect(
      canClaimAd(startedAt, new Date("2026-08-14T12:00:05.000Z"), REWARDED_AD_TIMER_SECONDS)
    ).toBe(true);
    expect(AD_TIMER_MESSAGE).toContain("5-second timer");
    expect(REWARDED_AD_TIMER_SECONDS).toBe(5);
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
