import { describe, expect, it } from "vitest";

describe("application title configuration", () => {
  it("keeps the Ads Earning title configured", () => {
    expect(process.env.VITE_APP_TITLE ?? "Ads Earning").toBe("Ads Earning");
  });
});
