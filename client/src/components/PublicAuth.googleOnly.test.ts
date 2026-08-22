import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Google-only new account entry", () => {
  it("keeps Gmail-password sign-in while removing the unverified custom sign-up form", () => {
    const source = readFileSync(new URL("./PublicAuth.tsx", import.meta.url), "utf8");
    const publicEntry = source.slice(0, source.indexOf("export function GoogleOnboarding"));

    expect(publicEntry).toContain("trpc.auth.signIn.useMutation");
    expect(publicEntry).toContain("onClick={startLogin}");
    expect(publicEntry).not.toContain("trpc.auth.register.useMutation");
    expect(publicEntry).not.toContain('mode === "signUp"');
  });
});
