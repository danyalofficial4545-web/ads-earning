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

  it("uses fixed withdrawal options and applies referral commission only after approval", () => {
    expect(source).toContain("fixedAmounts");
    expect(source).toContain("commissionCoins");
    expect(source).toContain('input.approved ? "approved" : "rejected"');
  });
});
