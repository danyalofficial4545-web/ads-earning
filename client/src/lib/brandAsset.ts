export const BRAND_IMAGE_URL = "/manus-storage/package-earn-brand_c51ccd45.png";
export const DEFAULT_BRAND_TEXT = "Ads";

export function getBrandImageSource(source?: string | null) {
  return source?.trim() || BRAND_IMAGE_URL;
}
