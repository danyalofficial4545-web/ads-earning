import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("attached payment and reward safeguards", () => {
  const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

  it("keeps payment account classifications aligned with their selected currency", () => {
    expect(source).toContain("currencyType: input.currency");
    expect(source).toContain("eq(paymentAccounts.currency, input.currency)");
  });

  it("limits withdrawals to the package-specific fixed amount sets", () => {
    expect(source).toContain("const fixedAmounts");
    expect(source).toContain("fixedAmounts.includes(amountPkr)");
    expect(source).toContain("profile.earningWalletBalance");
  });
});
