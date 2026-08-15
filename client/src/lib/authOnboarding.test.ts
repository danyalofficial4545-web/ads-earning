import { describe, expect, it } from "vitest";
import { requiresGoogleOnboarding, resolveWorkspaceGate } from "./authOnboarding";

describe("Google onboarding gate", () => {
  it("requires a newly Google-authenticated account without a password to complete setup", () => {
    expect(requiresGoogleOnboarding(false)).toBe(true);
    expect(requiresGoogleOnboarding(undefined)).toBe(true);
  });

  it("keeps existing password-based members and administrators on their normal workspace flow", () => {
    expect(requiresGoogleOnboarding(true)).toBe(false);
  });

  it("routes new Google users through combined onboarding before the dashboard while preserving existing account paths", () => {
    expect(resolveWorkspaceGate(false, "member42")).toBe("google-onboarding");
    expect(resolveWorkspaceGate(true, "existing_member")).toBe("workspace");
    expect(resolveWorkspaceGate(true, "danyal955163")).toBe("workspace");
    expect(resolveWorkspaceGate(true, "member42")).toBe("profile-setup");
  });
});
