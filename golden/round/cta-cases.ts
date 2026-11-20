import { AD_NETWORK_COLOURS } from "@/lib/render/ad-network";
import {
  deltaE,
  flatBackdrop,
  hslToRgb,
  toHex,
  type Rgb,
} from "@/lib/render/colour";
import {
  accentHue,
  pickCtaColour,
  type CtaPreference,
} from "@/lib/render/cta-colour";
import type { Box } from "@/lib/render/canvas";
import type { Pixels } from "@/lib/render/sample";
import { sceneHue } from "@/lib/render/scene-hue";
import type { CtaMode } from "@/lib/render/layout";
import { same, type Case } from "./cases";
import { NO_PREFERENCE, planned } from "./layout-cases";

const ORANGE: Rgb = [243, 117, 30];
const INK: Rgb = [34, 34, 34];
const GREY: Rgb = [128, 128, 128];
const TEAL: Rgb = [26, 143, 138];
const GUARD_BLUE: Rgb = [42, 100, 246];

const hue = (degrees: number) => hslToRgb(degrees, 0.8, 0.5);

const pixels = (size: number, at: (x: number, y: number) => Rgb): Pixels => {
  const data = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) data.set(at(x, y), (y * size + x) * 3);
  }
  return { data, width: size, height: size };
};

const PRODUCT = { x: 160, y: 160, w: 40, h: 40 };
const inProduct = (x: number, y: number) => x >= PRODUCT.x && y >= PRODUCT.y;

const HUE_ROWS: [string, Pixels, Box | null, number | null][] = [
  [
    "an orange gradient gives the bucket the orange sits in",
    pixels(200, (_, y) => hslToRgb(25, 0.9, 0.4 + (0.3 * y) / 200)),
    null,
    22.5,
  ],
  [
    "a scene split evenly across a bucket boundary takes the lower bucket",
    pixels(200, (x) => (x < 100 ? hue(10) : hue(20))),
    null,
    7.5,
  ],
  [
    "the product is left out: a blue product on an orange scene gives orange",
    pixels(200, (x, y) => (inProduct(x, y) ? hue(220) : hue(25))),
    PRODUCT,
    22.5,
  ],
  [
    "a neutral scene borrows the product's hue",
    pixels(200, (x, y) => (inProduct(x, y) ? hue(340) : GREY)),
    PRODUCT,
    337.5,
  ],
  [
    "a scene with under 5% chromatic pixels is neutral and borrows the product's hue",
    pixels(200, (x, y) => (inProduct(x, y) ? hue(220) : x < 8 ? hue(0) : GREY)),
    PRODUCT,
    217.5,
  ],
  [
    "a scene with 6% chromatic pixels has a hue of its own",
    pixels(200, (x, y) =>
      inProduct(x, y) ? hue(220) : x < 12 ? hue(0) : GREY,
    ),
    PRODUCT,
    7.5,
  ],
  [
    "a neutral scene and a neutral product have no hue",
    pixels(200, () => GREY),
    PRODUCT,
    null,
  ],
];

const baseline: CtaPreference = { ...NO_PREFERENCE };
const pick = (
  over: Partial<CtaPreference>,
  backdrop: Rgb,
  brand: Rgb[] = [ORANGE, INK],
) => {
  const result = pickCtaColour({
    ...baseline,
    ...over,
    brand,
    network: AD_NETWORK_COLOURS,
    backdrop: flatBackdrop(backdrop),
  });
  return {
    background: toHex(result.background),
    label: toHex(result.label),
    deltaE: Math.round(result.deltaE * 10) / 10,
    contrast: Math.round(result.contrast * 100) / 100,
  };
};

const WARM: Rgb = [243, 140, 60];
const PALE_BRAND = Array.from({ length: 24 }, (_, i) => i * 15).flatMap((h) =>
  [0.55, 0.7, 0.85].map((s) => hslToRgb(h, s, 0.865)),
);
const PICKS: [string, ReturnType<typeof pick>, ReturnType<typeof pick>][] = [
  [
    "auto with no scene hue starts at the brand's complement",
    pick({}, [255, 255, 255]),
    { background: "#1393ec", label: "#111111", deltaE: 43.7, contrast: 5.77 },
  ],
  [
    "auto follows the scene's hue, as deep as the rules need",
    pick({ sceneHue: 22.5 }, WARM),
    { background: "#a5460d", label: "#ffffff", deltaE: 27.8, contrast: 6.03 },
  ],
  [
    "dark searches only lightness 0.25 and below",
    pick({ mode: "dark", sceneHue: 22.5 }, WARM),
    { background: "#3d1a05", label: "#ffffff", deltaE: 24.6, contrast: 15.57 },
  ],
  [
    "light searches only lightness 0.85 to 0.88",
    pick({ mode: "light", sceneHue: 22.5 }, [150, 90, 50]),
    { background: "#fad7c2", label: "#111111", deltaE: 20.9, contrast: 14 },
  ],
  [
    "light falls back to auto when brand colours take every pale shade",
    pick({ mode: "light" }, GREY, PALE_BRAND),
    { background: "#13ecec", label: "#111111", deltaE: 28.9, contrast: 12.8 },
  ],
  [
    "brand uses the primary colour as it is, measured against network colours only",
    pick({ mode: "brand", primary: TEAL, secondary: ORANGE }, WARM),
    { background: "#1a8f8a", label: "#111111", deltaE: 56.2, contrast: 4.8 },
  ],
  [
    "brand takes the secondary when the primary is an ad-network colour",
    pick({ mode: "brand", primary: [0, 0, 0], secondary: ORANGE }, WARM),
    { background: "#f3751e", label: "#111111", deltaE: 86.4, contrast: 6.63 },
  ],
  [
    "brand falls back to auto when no brand colour is usable",
    pick({ mode: "brand", primary: GUARD_BLUE, secondary: null }, WARM),
    { background: "#1393ec", label: "#111111", deltaE: 43.7, contrast: 5.77 },
  ],
  [
    "a preferred colour that still passes is kept",
    pick({ preferred: [150, 30, 60] }, WARM),
    { background: "#961e3c", label: "#ffffff", deltaE: 55.7, contrast: 8.24 },
  ],
  [
    "a preferred colour within ΔE 20 of a brand colour is re-picked in auto",
    pick({ preferred: ORANGE }, [255, 255, 255]),
    { background: "#1393ec", label: "#111111", deltaE: 43.7, contrast: 5.77 },
  ],
  [
    "the same colour is kept in brand mode, where brand colours are allowed",
    pick(
      { mode: "brand", primary: ORANGE, preferred: ORANGE },
      [255, 255, 255],
    ),
    { background: "#f3751e", label: "#111111", deltaE: 86.4, contrast: 6.63 },
  ],
];

const BRANDS: [string, Rgb[]][] = [
  ["blue brand", [[31, 78, 121]]],
  ["orange brand", [ORANGE]],
  [
    "black and white brand",
    [
      [0, 0, 0],
      [255, 255, 255],
    ],
  ],
  ["no brand colours", []],
  ["a brand sitting on the guard blue", [GUARD_BLUE, ORANGE]],
];
const MODES: CtaMode[] = ["auto", "dark", "light", "brand"];

const RULE_CASES: Case[] = BRANDS.map(([name, brand]) => ({
  name: `CTA colour for a ${name} passes the rules in every mode`,
  run: () => {
    const problems = MODES.flatMap((mode) => {
      const cta = pickCtaColour({
        ...baseline,
        mode,
        primary: brand[0] ?? null,
        secondary: brand[1] ?? null,
        sceneHue: 200,
        brand,
        network: AD_NETWORK_COLOURS,
        backdrop: flatBackdrop([200, 210, 220]),
      });
      const others = mode === "brand" ? [] : brand;
      const nearest = Math.min(
        ...[...others, ...AD_NETWORK_COLOURS].map((c) =>
          deltaE(cta.background, c),
        ),
      );
      return cta.contrast >= 4.5 && nearest >= 20
        ? []
        : [`${mode}: contrast ${cta.contrast}, ΔE ${nearest}`];
    });
    return problems.length === 0 ? null : problems.join("; ");
  },
}));

const layoutCta = (backdrop: Rgb, hueOfScene: number) => {
  const { cta } = planned(
    { headline: "Slow mornings", cta: "Shop now" },
    null,
    {
      brandColours: [ORANGE],
      cta: { ...NO_PREFERENCE, sceneHue: hueOfScene },
      sample: () => flatBackdrop(backdrop),
    },
  );
  return { background: cta.background, mode: cta.mode };
};

export const CTA_CASES: Case[] = [
  ...HUE_ROWS.map(([name, image, product, expected]): Case => ({
    name: `scene hue: ${name}`,
    run: () => same(sceneHue(image, product), expected),
  })),
  ...PICKS.map(([name, actual, expected]): Case => ({
    name: `CTA colour: ${name}`,
    run: () => same(actual, expected),
  })),
  ...RULE_CASES,
  {
    name: "CTA hue starts at the complement of the first chromatic brand colour",
    run: () =>
      same(
        Math.round(
          accentHue([
            [0, 0, 0],
            [0, 0, 255],
          ]),
        ),
        60,
      ),
  },
  {
    name: "layout: the same brand on two backgrounds gives two CTA colours, and stores the mode",
    run: () =>
      same(
        [layoutCta(WARM, 22.5), layoutCta([120, 140, 170], 217.5)],
        [
          { background: "#a5460d", mode: "auto" },
          { background: "#0f50bd", mode: "auto" },
        ],
      ),
  },
];
