export const PACKAGE_DISCOUNT_RATE = 0.15;
export const PACKAGE_PRICE_MULTIPLIER = 1 - PACKAGE_DISCOUNT_RATE;

export function getDiscountedPackagePrice(originalPricePkr: number) {
  return Math.floor(originalPricePkr * PACKAGE_PRICE_MULTIPLIER);
}
