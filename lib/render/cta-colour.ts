import {
  CTA_MIN_CONTRAST,
  CTA_MIN_DELTA_E,
  CTA_STAND_OUT_CONTRAST,
  CTA_STAND_OUT_DELTA_E,
} from "@/lib/config";
import {
  contrast,
  DARK_INK,
  deltaE,
  hslToRgb,
  LIGHT_INK,
  minDeltaE,
  rgbToHsl,
  type Backdrop,
  type Rgb,
} from "./colour";
import type { CtaMode } from "./layout";

export type CtaColour = {
  background: Rgb;
  label: Rgb;
  deltaE: number;
  contrast: number;
};

// What the button's colour may follow besides the rules: the tester's mode, the brand's own colours for "brand", the scene's hue, and a colour an edit keeps while it still passes.
export type CtaPreference = {
  mode: CtaMode;
  primary: Rgb | null;
  secondary: Rgb | null;
  sceneHue: number | null;
  preferred: Rgb | null;
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
// Around the scene's own hue, tried before the brand complement's.
const SCENE_HUE_OFFSETS = [0, 20, -20, 40, -40] as const;
// Darkest first, and palest first: a dark button stays under 0.25, and above about 0.9 a pale one is within ΔE 20 of white.
const DARK_LIGHTNESS = [0.1, 0.13, 0.16, 0.19, 0.22, 0.25] as const;
const LIGHT_LIGHTNESS = [0.88, 0.87, 0.86, 0.85] as const;

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

const standsOut = (background: Rgb, backdrop: Backdrop) =>
  contrast(background, backdrop.mean) >= CTA_STAND_OUT_CONTRAST ||
  deltaE(background, backdrop.mean) >= CTA_STAND_OUT_DELTA_E;

// A button at least CTA_MIN_DELTA_E from every ad-network colour, and (except in "brand" mode) every brand colour, with a label at CTA_MIN_CONTRAST. "auto" follows the scene: hues around its own first, then the brand's complement, taking the first shade that also stands out from what is behind the button, else the first that passes the rules. "dark" and "light" search only their shades and fall back to "auto"; "brand" is the brand's primary or secondary colour as it is, else "auto". A preferred colour that still passes the rules is kept.
export function pickCtaColour(
  input: CtaPreference & {
    brand: readonly Rgb[];
    network: readonly Rgb[];
    backdrop: Backdrop;
  },
): CtaColour {
  const { mode, backdrop } = input;
  const avoid = (brandRule: boolean) =>
    brandRule ? [...input.brand, ...input.network] : input.network;
  const measure = (background: Rgb, brandRule: boolean): CtaColour => {
    const { ink, ratio } = label(background);
    return {
      background,
      label: ink,
      deltaE: minDeltaE(background, avoid(brandRule)),
      contrast: ratio,
    };
  };
  const passes = (colour: CtaColour) =>
    colour.contrast >= CTA_MIN_CONTRAST && colour.deltaE >= CTA_MIN_DELTA_E;

  if (input.preferred) {
    const kept = measure(input.preferred, mode !== "brand");
    if (passes(kept)) return kept;
  }
  if (mode === "brand") {
    for (const brand of [input.primary, input.secondary]) {
      const own = brand && measure(brand, false);
      if (own && passes(own)) return own;
    }
  }

  const { sceneHue } = input;
  const hues = [
    ...(sceneHue === null
      ? []
      : SCENE_HUE_OFFSETS.map((offset) => sceneHue + offset)),
    ...HUE_OFFSETS.map((offset) => accentHue(input.brand) + offset),
  ];
  const scan = (lightnesses: readonly number[]) => {
    let passing: CtaColour | null = null;
    let best: CtaColour | null = null;
    for (const hue of hues) {
      for (const saturation of SATURATIONS) {
        for (const lightness of lightnesses) {
          const background = hslToRgb(hue, saturation, lightness);
          const candidate = measure(background, true);
          if (passes(candidate)) {
            if (standsOut(background, backdrop)) {
              return { pick: candidate, passing, best };
            }
            passing ??= candidate;
          } else if (
            candidate.contrast >= CTA_MIN_CONTRAST &&
            candidate.deltaE > (best?.deltaE ?? -1)
          ) {
            best = candidate;
          }
        }
      }
    }
    return { pick: null, passing, best };
  };

  const tones = { dark: DARK_LIGHTNESS, light: LIGHT_LIGHTNESS } as const;
  if (mode === "dark" || mode === "light") {
    const toned = scan(tones[mode]);
    const kept = toned.pick ?? toned.passing;
    if (kept) return kept;
  }
  const found = scan(LIGHTNESS);
  const colour = found.pick ?? found.passing ?? found.best;
  if (!colour) throw new Error("cta colour: no readable accent exists");
  return colour;
}
