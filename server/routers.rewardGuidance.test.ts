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

  it("credits referral rewards to the Earning Wallet", () => {
    expect(source).toContain("earningWalletBalance");
    expect(source).toContain("commission * 100");
    expect(source).not.toContain("referrer.withdrawalLimitPkr + credit");
  });
});
