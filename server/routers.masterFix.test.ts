import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("attached payment and reward safeguards", () => {
  const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

  it("keeps payment account classifications aligned with their selected currency", () => {
    expect(source).toContain("currencyType: input.currency");
    expect(source).toContain("eq(paymentAccounts.currency, input.currency)");
  });

  it("limits the package exception to the exact one-time channel reward amount", () => {
    expect(source).toContain("amountPkr !== WHATSAPP_JOIN_REWARD_PKR");
    expect(source).toContain("!activePackage && !hasPendingChannelReward");
    expect(source).toContain("profile.earningWalletBalance");
  });
});
