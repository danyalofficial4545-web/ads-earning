import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("member withdrawal history privacy", () => {
  it("shows only status-safe withdrawal history fields and never renders the wallet name or number", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).not.toContain('kind === "withdrawal" && item.accountName');
    expect(source).not.toContain('kind === "withdrawal" && item.accountDetails');
  });
});
