import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("entitled-only rewarded ad payload", () => {
  it("derives only visible sequential slots from the active package quota without returning a locked state", () => {
    const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

    expect(source).toContain("length: continuationRequired ? claimedCount : quota");
    expect(source).toContain('state: slot <= claimedCount ? "watched" as const : "unlocked" as const');
    expect(source).not.toContain('state: slot <= claimedCount ? "watched" as const : slot === claimedCount + 1');
  });
});
