import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, createHumanChallenge, hashSecurityValue, matchesHumanChallenge } from "./security";

describe("authentication security helpers", () => {
  it("uses non-reversible stable markers for devices and networks", () => {
    expect(hashSecurityValue("device-a")).toHaveLength(64);
    expect(hashSecurityValue("device-a")).toBe(hashSecurityValue("device-a"));
    expect(clientIpFromHeaders({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })).toBe("203.0.113.7");
  });

  it("creates expiring visual code challenges that accept only the code shown in the image", () => {
    const challenge = createHumanChallenge();
    expect(challenge.imageData).toMatch(/^data:image\/svg\+xml;base64,/);
    const svg = Buffer.from(challenge.imageData.split(",")[1]!, "base64").toString("utf8");
    const code = Array.from(svg.matchAll(/>([A-Z0-9])<\/text>/g)).map(match => match[1]).join("");
    expect(code).toHaveLength(5);
    expect(matchesHumanChallenge(code.toLowerCase(), challenge.answerHash)).toBe(true);
    expect(matchesHumanChallenge("WRONG", challenge.answerHash)).toBe(false);
    expect(challenge.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
