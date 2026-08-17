import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, createHumanChallenge, hashSecurityValue, matchesHumanChallenge } from "./security";
import { HUMAN_IMAGE_OPTIONS } from "../shared/humanVerification";

describe("authentication security helpers", () => {
  it("uses non-reversible stable markers for devices and networks", () => {
    expect(hashSecurityValue("device-a")).toHaveLength(64);
    expect(hashSecurityValue("device-a")).toBe(hashSecurityValue("device-a"));
    expect(clientIpFromHeaders({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })).toBe("203.0.113.7");
  });

  it("creates expiring image-select challenges that accept only the matching image option", () => {
    const challenge = createHumanChallenge();
    const matching = HUMAN_IMAGE_OPTIONS.find(option => matchesHumanChallenge(option.id, challenge.answerHash));
    expect(matching).toBeDefined();
    expect(challenge.prompt).toContain(matching!.label);
    const different = HUMAN_IMAGE_OPTIONS.find(option => option.id !== matching!.id)!;
    expect(matchesHumanChallenge(different.id, challenge.answerHash)).toBe(false);
    expect(challenge.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
