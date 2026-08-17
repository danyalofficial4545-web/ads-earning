import { describe, expect, it } from "vitest";
import { shouldAutoClaimAd } from "./adTimer";

describe("non-expiring ad card timer", () => {
  it("automatically claims once when the ten-second card timer completes", () => {
    expect(shouldAutoClaimAd({ hasSession: true, secondsRemaining: 0, autoClaimAttempted: false, claimPending: false })).toBe(true);
  });

  it("does not automatically retry after a failed claim, preserving manual retry", () => {
    expect(shouldAutoClaimAd({ hasSession: true, secondsRemaining: 0, autoClaimAttempted: true, claimPending: false })).toBe(false);
    expect(shouldAutoClaimAd({ hasSession: true, secondsRemaining: 1, autoClaimAttempted: false, claimPending: false })).toBe(false);
  });
});
