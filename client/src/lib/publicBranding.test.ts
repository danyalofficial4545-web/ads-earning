import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolvePublicBranding } from "./publicBranding";

describe("safe public branding", () => {
  it("uses Ads Earning when no administrator branding has been saved", () => {
    expect(resolvePublicBranding()).toEqual({
      websiteName: "Ads Earning",
      themeName: "green",
      logoUrl: null,
    });
  });

  it("preserves a saved website name, theme, and logo without needing financial settings", () => {
    expect(resolvePublicBranding({ websiteName: "Earn With Danyal", themeName: "blue", logoUrl: "/manus-storage/logo.png" })).toEqual({ websiteName: "Earn With Danyal", themeName: "blue", logoUrl: "/manus-storage/logo.png" });
  });

  it("makes both public and signed-in shells consume the shared safe-branding resolver", () => {
    const publicAuth = readFileSync(new URL("../components/PublicAuth.tsx", import.meta.url), "utf8");
    const home = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
    expect(publicAuth).toContain("resolvePublicBranding(branding.data?.branding)");
    expect(home).toContain("resolvePublicBranding(publicData.data?.branding)");
    expect(publicAuth).not.toContain("branding.data?.settings");
    expect(home).not.toContain("publicData.data?.settings");
  });
});
