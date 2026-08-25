import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("compact Ads/Tasks grid", () => {
  it("uses a two-column compact card grid with watch and claim controls but no locked state", () => {
    const source = readFileSync(new URL("./AdsTasks.tsx", import.meta.url), "utf8");
    expect(source).toContain('className="grid grid-cols-2 gap-3"');
    expect(source).toContain('h-[140px]');
    expect(source).not.toContain('t("lockedAd")');
    expect(source).toContain('t("claimReward")');
    expect(source).toContain('t("watchAd")');
  });
});
