import { describe, expect, it } from "vitest";
import { getDiscountedPackagePrice, PACKAGE_DISCOUNT_RATE } from "../shared/packagePricing";

describe("package discount pricing", () => {
  it("keeps the discount at 15%", () => {
    expect(PACKAGE_DISCOUNT_RATE).toBe(0.15);
  });

  it("calculates discounted package prices", () => {
    expect(getDiscountedPackagePrice(1000)).toBe(850);
    expect(getDiscountedPackagePrice(5000)).toBe(4250);
  });
});
