import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("historical 10 PKR reward withdrawal guidance", () => {
  const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

  it("uses every matching PKR 10 withdrawal history record to hide the reward prompt, regardless of review status", () => {
    const historyQuery = source.slice(
      source.indexOf("const rewardWithdrawalHistory = await db"),
      source.indexOf("const rewardWithdrawalRequested =")
    );

    expect(source).toContain("const rewardWithdrawalHistory = await db");
    expect(historyQuery).toContain("eq(withdrawals.currency, \"PKR\")");
    expect(historyQuery).toContain("eq(withdrawals.amountPkr, WHATSAPP_JOIN_REWARD_PKR)");
    expect(source).toContain("rewardWithdrawalHistory.length > 0");
    expect(historyQuery).not.toContain("withdrawals.status");
  });

  it("continues to calculate referral credit only as a withdrawal-limit update", () => {
    expect(source).toContain("const credit = referralLimitCredit(");
    expect(source).toContain("settings.referralCommissionPercent");
    expect(source).toContain(".set({ withdrawalLimitPkr: referrer.withdrawalLimitPkr + credit })");
  });
});
