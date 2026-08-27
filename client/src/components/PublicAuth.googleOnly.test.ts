import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dual Google and Gmail account entry", () => {
  it("keeps Gmail-password sign-in, manual signup, and the Google entry route", () => {
    const source = readFileSync(new URL("./PublicAuth.tsx", import.meta.url), "utf8");
    const publicEntry = source.slice(0, source.indexOf("export function GoogleOnboarding"));

    expect(publicEntry).toContain("trpc.auth.signIn.useMutation");
    expect(publicEntry).toContain("trpc.auth.register.useMutation");
    expect(publicEntry).toContain("onClick={() => startLogin()}");
    expect(publicEntry).toContain('mode === "signUp"');
    expect(publicEntry).toContain("VisualCodeCheck");
  });

  it("uses a safe Manus OAuth portal fallback when Vercel omits the portal env variable", () => {
    const launcher = readFileSync(new URL("../const.ts", import.meta.url), "utf8");

    expect(launcher).toContain('import.meta.env.VITE_OAUTH_PORTAL_URL || "https://manus.im"');
    expect(launcher).toContain('new URL("/app-auth", oauthPortalUrl)');
  });
});
