import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("premium red branding", () => {
  it("uses the generated AdEarn logo and red white-card theme treatment", () => {
    const asset = readFileSync(new URL("./brandAsset.ts", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../index.css", import.meta.url), "utf8");

    expect(asset).toContain("adearn-premium-red-logo_f73f176b.png");
    expect(styles).toContain('.pep-page[data-pep-theme="red"] header');
    expect(styles).toContain(".premium-package-card");
    expect(styles).toContain("linear-gradient(105deg, #7f1d1d, #dc2626 55%, #e11d48)");
  });
});
