import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package-specific rewarded slot presentation", () => {
  it("shows the requested earning-page title, package reward, five-second duration, and no-package guidance", () => {
    const source = readFileSync(new URL("./AdsTasks.tsx", import.meta.url), "utf8");
    expect(source).toContain('t("earnPageTitle")');
    expect(source).toContain('t("noPackageAdsMessage")');
    expect(source).toContain('`${ad.title} - ${ad.timerSeconds} Sec - ${t("reward")} ${ad.rewardPkr} PKR`');
    expect(source).toContain("ads.data.ads.map");
  });
});
