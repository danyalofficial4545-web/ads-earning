export type PublicBranding = {
  websiteName: string;
  themeName: "green" | "blue" | "dark" | "white" | "black" | "red" | "yellow";
  buttonColor: "amber" | "white" | "black" | "red" | "green" | "yellow" | "blue" | "purple" | "pink" | "orange" | "teal";
  logoUrl: string | null;
};

type PublicBrandingInput = Partial<Omit<PublicBranding, "buttonColor">> & {
  buttonColor?: string | null;
};

const buttonColors: PublicBranding["buttonColor"][] = ["amber", "white", "black", "red", "green", "yellow", "blue", "purple", "pink", "orange", "teal"];

const defaultBranding: PublicBranding = {
  websiteName: "Ads Earning",
  themeName: "green",
  buttonColor: "amber",
  logoUrl: null,
};

export function resolvePublicBranding(
  branding?: PublicBrandingInput | null,
): PublicBranding {
  const buttonColor = buttonColors.includes(branding?.buttonColor as PublicBranding["buttonColor"])
    ? (branding?.buttonColor as PublicBranding["buttonColor"])
    : defaultBranding.buttonColor;
  return {
    websiteName: branding?.websiteName || defaultBranding.websiteName,
    themeName: branding?.themeName || defaultBranding.themeName,
    buttonColor,
    logoUrl: branding?.logoUrl || null,
  };
}
