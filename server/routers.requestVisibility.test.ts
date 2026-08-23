import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("administrator request visibility and reward completion", () => {
  const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

  it("keeps requests visible until approval, then hides approved request cards one hour after review without deleting them", () => {
    expect(source).toContain("const approvedVisibilityCutoff = Date.now() - 60 * 60 * 1000");
    expect(source).toContain('row.status !== "approved"');
    expect(source).toContain("depositRows.filter(remainsVisibleInActiveRequests)");
    expect(source).toContain("withdrawalRows.filter(remainsVisibleInActiveRequests)");
  });

  it("marks the one-time channel reward as withdrawn only after an approved qualifying withdrawal", () => {
    expect(source).toContain("input.approved &&");
    expect(source).toContain("!profile.whatsappRewardWithdrawn");
    expect(source).toContain("request.amountPkr >= WHATSAPP_JOIN_REWARD_PKR");
    expect(source).toContain("whatsappRewardWithdrawn: true");
  });
});
