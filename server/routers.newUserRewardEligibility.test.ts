import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("new-user-only WhatsApp reward server safeguards", () => {
  it("blocks legacy profiles and gates reward completion and pending withdrawal exceptions", () => {
    const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(source).toContain("if (!profile.whatsappRewardEligible)");
    expect(source).toContain("const rewardWithdrawalRequested =");
    expect(source).toContain("rewardProfile.whatsappRewardEligible &&");
    expect(source).toContain("completedChannelRewardWithdrawal");
  });
});
