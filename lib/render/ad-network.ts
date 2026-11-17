import type { Rgb } from "./colour";

// Sampled once on Nov 16, 2026 from AppLovin's official mark (https://www.applovin.com/icon.svg, the same mark brand-guidelines links): black artwork (fill="black") on white (fill="white").
export const APPLOVIN_LOGO: readonly Rgb[] = [
  [0, 0, 0],
  [255, 255, 255],
];

// The blue AppLovin's own site uses for its icons (#2A64F6 fills on https://www.applovin.com/brand-guidelines/). Not in the logo; kept as a guard so a CTA never reads as network chrome.
export const APPLOVIN_ACCENT: Rgb = [42, 100, 246];

export const AD_NETWORK_COLOURS: readonly Rgb[] = [
  ...APPLOVIN_LOGO,
  APPLOVIN_ACCENT,
];
