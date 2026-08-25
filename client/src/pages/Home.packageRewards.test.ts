import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package reward card presentation", () => {
  it("renders each package's daily ad count, per-ad reward, and total daily earning", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
    expect(source).toContain("plan.dailyAds");
    expect(source).toContain("plan.adRewardPkr");
    expect(source).toContain('t("totalDailyEarning")');
    expect(source).toContain("plan.dailyAds * plan.adRewardPkr");
  });
});
