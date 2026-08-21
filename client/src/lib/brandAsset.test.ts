import { describe, expect, it } from "vitest";
import {
  BRAND_IMAGE_URL,
  DEFAULT_BRAND_TEXT,
  getBrandImageSource,
} from "./brandAsset";

describe("brand asset fallback", () => {
  it("uses the configured logo URL when one is available", () => {
    expect(getBrandImageSource("https://example.com/logo.png")).toBe(
      "https://example.com/logo.png",
    );
  });

  it("keeps the managed logo source and Ads text fallback available", () => {
    expect(getBrandImageSource()).toBe(BRAND_IMAGE_URL);
    expect(DEFAULT_BRAND_TEXT).toBe("Ads");
  });
});
