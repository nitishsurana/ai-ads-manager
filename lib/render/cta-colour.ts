import { CTA_MIN_CONTRAST, CTA_MIN_DELTA_E } from "@/lib/config";
import {
  contrast,
  DARK_INK,
  hslToRgb,
  LIGHT_INK,
  minDeltaE,
  rgbToHsl,
  type Rgb,
} from "./colour";

export type CtaColour = {
  background: Rgb;
  label: Rgb;
  deltaE: number;
  contrast: number;
};

// A brand colour with less saturation than this is a neutral and has no hue to oppose.
const NEUTRAL_SATURATION = 0.15;
const NEUTRAL_FALLBACK_HUE = 28;
const SATURATIONS = [0.85, 0.7, 0.55] as const;
// Mid-tones first, then outwards: the lightness is adjusted until the rule passes.
const LIGHTNESS = [
  0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8,
] as const;
const HUE_OFFSETS = [
  0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180,
] as const;

// Complement of the first chromatic brand colour, in the order given (primary first).
export function accentHue(brand: readonly Rgb[]) {
  for (const colour of brand) {
    const [hue, saturation] = rgbToHsl(colour);
    if (saturation >= NEUTRAL_SATURATION) return (hue + 180) % 360;
  }
  return NEUTRAL_FALLBACK_HUE;
}

function label(background: Rgb) {
  const light = contrast(LIGHT_INK, background);
  const dark = contrast(DARK_INK, background);
  return light >= dark
    ? { ink: LIGHT_INK, ratio: light }
    : { ink: DARK_INK, ratio: dark };
}

// An accent that is at least CTA_MIN_DELTA_E from every brand and ad-network colour, with a label at CTA_MIN_CONTRAST. Starts at the brand's complementary hue and moves lightness, then saturation and hue, until the rule passes.
export function pickCtaColour(input: {
  brand: readonly Rgb[];
  network: readonly Rgb[];
}): CtaColour {
  const avoid = [...input.brand, ...input.network];
  const base = accentHue(input.brand);
  let best: CtaColour | null = null;
  for (const offset of HUE_OFFSETS) {
    for (const saturation of SATURATIONS) {
      for (const lightness of LIGHTNESS) {
        const background = hslToRgb(base + offset, saturation, lightness);
        const { ink, ratio } = label(background);
        const distance = minDeltaE(background, avoid);
        const candidate = {
          background,
          label: ink,
          deltaE: distance,
          contrast: ratio,
        };
        if (ratio >= CTA_MIN_CONTRAST && distance >= CTA_MIN_DELTA_E) {
          return candidate;
        }
        if (ratio >= CTA_MIN_CONTRAST && distance > (best?.deltaE ?? -1)) {
          best = candidate;
        }
      }
    }
  }
  if (!best) throw new Error("cta colour: no readable accent exists");
  return best;
}
