import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("new-user-only WhatsApp reward presentation", () => {
  it("gates channel prompts, reward withdrawal access, and post-reward guidance by persisted eligibility", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/profile\.whatsappRewardEligible[\s\S]*?!profile\.whatsappJoined/);
    expect(source).toContain("memberProfile.whatsappRewardEligible &&");
    expect(source).toContain("memberProfile.whatsappBonusClaimed &&");
    expect(source).toContain("memberProfile.whatsappRewardEligible && rewardWithdrawalRequested");
  });
});
