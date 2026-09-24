import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("new-user-only WhatsApp reward server safeguards", () => {
  it("keeps legacy reward flags harmless while fixed withdrawals remain enforced", () => {
    const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(source).toContain("if (!profile.whatsappRewardEligible)");
    expect(source).toContain("const rewardWithdrawalRequested =");
    expect(source).toContain("rewardProfile.whatsappRewardEligible &&");
    expect(source).toContain("const fixedAmounts");
    expect(source).toContain("rewardWithdrawalSubmitted: false");
  });
});
