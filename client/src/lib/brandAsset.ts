export const BRAND_IMAGE_URL = "/manus-storage/adearn-premium-red-logo_f73f176b.png";
export const DEFAULT_BRAND_TEXT = "Ads";

export function getBrandImageSource(source?: string | null) {
  return source?.trim() || BRAND_IMAGE_URL;
}
