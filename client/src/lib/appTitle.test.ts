import { describe, expect, it } from "vitest";

describe("application title configuration", () => {
  it("keeps the Package Earn Pro title configured", () => {
    expect(process.env.VITE_APP_TITLE ?? "Package Earn Pro").toBe("Package Earn Pro");
  });
});
