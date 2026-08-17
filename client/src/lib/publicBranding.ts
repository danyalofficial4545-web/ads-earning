export type PublicBranding = {
  websiteName: string;
  themeName: "green" | "blue" | "dark" | "white";
  logoUrl: string | null;
};

const defaultBranding: PublicBranding = {
  websiteName: "Package Earn Pro",
  themeName: "green",
  logoUrl: null,
};

export function resolvePublicBranding(
  branding?: Partial<PublicBranding> | null,
): PublicBranding {
  return {
    websiteName: branding?.websiteName || defaultBranding.websiteName,
    themeName: branding?.themeName || defaultBranding.themeName,
    logoUrl: branding?.logoUrl || null,
  };
}
