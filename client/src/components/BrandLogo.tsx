import {
  DEFAULT_BRAND_TEXT,
  getBrandImageSource,
} from "@/lib/brandAsset";
import { useState } from "react";

type BrandLogoProps = {
  src?: string | null;
  name?: string | null;
  className?: string;
};

export function BrandLogo({
  src,
  name = "Ads Earning",
  className = "size-11",
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const imageSource = failed ? null : getBrandImageSource(src);

  if (!imageSource) {
    return (
      <span
        role="img"
        aria-label={`${name} logo`}
        className={`grid shrink-0 place-items-center rounded-2xl border border-amber-300/40 bg-amber-300 px-2 text-xs font-black tracking-tight text-slate-950 shadow-lg shadow-amber-400/20 ${className}`}
      >
        {DEFAULT_BRAND_TEXT}
      </span>
    );
  }

  return (
    <img
      src={imageSource}
      alt={`${name} logo`}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-2xl border border-amber-300/30 object-cover shadow-lg shadow-amber-400/20 ${className}`}
    />
  );
}
