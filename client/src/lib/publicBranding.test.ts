import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolvePublicBranding } from "./publicBranding";

describe("safe public branding", () => {
  it("uses Ads Earning when no administrator branding has been saved", () => {
    expect(resolvePublicBranding()).toEqual({
      websiteName: "Ads Earning",
      themeName: "green",
      buttonColor: "amber",
      logoUrl: null,
    });
  });

  it("preserves a saved website name, theme, and logo without needing financial settings", () => {
    expect(resolvePublicBranding({ websiteName: "Earn With Danyal", themeName: "blue", buttonColor: "purple", logoUrl: "/manus-storage/logo.png" })).toEqual({ websiteName: "Earn With Danyal", themeName: "blue", buttonColor: "purple", logoUrl: "/manus-storage/logo.png" });
    expect(resolvePublicBranding({ buttonColor: "unknown" })).toMatchObject({ buttonColor: "amber" });
  });

  it("makes both public and signed-in shells consume the shared safe-branding resolver", () => {
    const publicAuth = readFileSync(new URL("../components/PublicAuth.tsx", import.meta.url), "utf8");
    const home = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
    expect(publicAuth).toContain("resolvePublicBranding(branding.data?.branding)");
    expect(home).toContain("resolvePublicBranding(publicData.data?.branding)");
    expect(publicAuth).toContain("data-pep-button={brandSettings.buttonColor}");
    expect(home).toContain("data-pep-button={branding.buttonColor}");
    expect(publicAuth).not.toContain("branding.data?.settings");
    expect(home).not.toContain("publicData.data?.settings");
  });
});
