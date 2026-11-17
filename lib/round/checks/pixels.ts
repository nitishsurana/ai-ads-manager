import sharp from "sharp";
import {
  LOGO_MIN_CONTRAST,
  PRODUCT_BAD_SHARE,
  PRODUCT_MEAN_TOLERANCE,
  PRODUCT_PIXEL_DELTA,
  TEXT_MIN_CONTRAST,
} from "@/lib/config";
import {
  sampleBackdrop,
  type Box,
  type Layout,
  type Pixels,
} from "@/lib/render";
import { fromHex, worstContrast } from "@/lib/render/colour";

const BAND = 8;
const INNER_FROM = 16;
const UNIFORM_STD = 8;
const STEP = 40;
const FRAMED_EDGES = 2;
const STRIDE = 4;

type Edge = { x0: number; y0: number; x1: number; y1: number };

function stats(pixels: Pixels, { x0, y0, x1, y1 }: Edge) {
  const sum = [0, 0, 0];
  const lumas: number[] = [];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += STRIDE) {
      const i = (y * pixels.width + x) * 3;
      const rgb = [0, 1, 2].map((c) => pixels.data[i + c] ?? 0);
      rgb.forEach((v, c) => (sum[c] = (sum[c] ?? 0) + v));
      lumas.push(
        0.2126 * (rgb[0] ?? 0) +
          0.7152 * (rgb[1] ?? 0) +
          0.0722 * (rgb[2] ?? 0),
      );
    }
  }
  const n = lumas.length;
  const mean = sum.map((v) => v / n);
  const lumaMean = lumas.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(lumas.reduce((a, b) => a + (b - lumaMean) ** 2, 0) / n);
  return { mean, std };
}

// A frame: at least two edges where an outer strip of one flat colour steps sharply to what lies just inside it. A flat or smoothly graded background has no such step.
export function borderProblems(pixels: Pixels) {
  const { width: w, height: h } = pixels;
  const pairs: [string, Edge, Edge][] = [
    [
      "top",
      { x0: 0, y0: 0, x1: w, y1: BAND },
      { x0: 0, y0: INNER_FROM, x1: w, y1: INNER_FROM + BAND },
    ],
    [
      "bottom",
      { x0: 0, y0: h - BAND, x1: w, y1: h },
      { x0: 0, y0: h - INNER_FROM - BAND, x1: w, y1: h - INNER_FROM },
    ],
    [
      "left",
      { x0: 0, y0: 0, x1: BAND, y1: h },
      { x0: INNER_FROM, y0: 0, x1: INNER_FROM + BAND, y1: h },
    ],
    [
      "right",
      { x0: w - BAND, y0: 0, x1: w, y1: h },
      { x0: w - INNER_FROM - BAND, y0: 0, x1: w - INNER_FROM, y1: h },
    ],
  ];
  const framed = pairs.filter(([, outer, inner]) => {
    const a = stats(pixels, outer);
    const b = stats(pixels, inner);
    const step = Math.max(
      ...a.mean.map((v, c) => Math.abs(v - (b.mean[c] ?? 0))),
    );
    return a.std < UNIFORM_STD && step > STEP;
  });
  return framed.length >= FRAMED_EDGES
    ? [
        `border: a frame on the ${framed.map(([edge]) => edge).join(", ")} edges`,
      ]
    : [];
}

// The ink of each text block and the logo against the pixels they sit on (the background with the scrim over it), at the worst brightness percentile.
export function contrastProblems(base: Pixels, layout: Layout) {
  const problems: string[] = [];
  const texts: [string, Layout["headline"] | NonNullable<Layout["eyebrow"]>][] =
    [
      ["headline", layout.headline],
      ...(layout.eyebrow
        ? [["eyebrow", layout.eyebrow] as [string, typeof layout.headline]]
        : []),
    ];
  for (const [name, text] of texts) {
    const seen = worstContrast(
      fromHex(text.colour),
      sampleBackdrop(base, text.box),
    );
    if (seen < TEXT_MIN_CONTRAST) {
      problems.push(
        `contrast: the ${name} on the pixels is ${seen.toFixed(2)}, under ${TEXT_MIN_CONTRAST}`,
      );
    }
  }
  const { logo } = layout;
  if (logo?.ink) {
    const ink = fromHex(logo.ink);
    const seen = logo.panel
      ? worstContrast(ink, {
          mean: fromHex(logo.panel.colour),
          dark: fromHex(logo.panel.colour),
          light: fromHex(logo.panel.colour),
          busy: 0,
        })
      : worstContrast(ink, sampleBackdrop(base, logo.box));
    if (seen < LOGO_MIN_CONTRAST) {
      problems.push(
        `contrast: the logo on the pixels is ${seen.toFixed(2)}, under ${LOGO_MIN_CONTRAST}`,
      );
    }
  }
  return problems;
}

// Boxes of what is drawn over the product on purpose, and the scrim, whose fade can reach its top.
export function drawnBoxes(layout: Layout): Box[] {
  return [
    layout.headline.box,
    layout.cta.box,
    ...(layout.eyebrow ? [layout.eyebrow.box] : []),
    ...(layout.badge ? [layout.badge.box] : []),
    ...(layout.logo
      ? [layout.logo.box, ...(layout.logo.panel ? [layout.logo.panel.box] : [])]
      : []),
    ...(layout.scrim ? [layout.scrim.box] : []),
  ];
}

export type Expected = { rgba: Buffer; box: Box };

// The product's pixels in the final creative against the re-derived cut-out (or, for a whole photo, the resized source) where it is fully opaque and nothing is drawn over it. A small tolerance covers the JPEG the background is stored as.
export async function productProblems(
  final: Buffer,
  expected: Expected,
  excluded: Box[],
) {
  const { box } = expected;
  const seen = await sharp(final)
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .removeAlpha()
    .raw()
    .toBuffer();
  const drawn = excluded.map(
    (d) =>
      [d.x - box.x, d.y - box.y, d.x + d.w - box.x, d.y + d.h - box.y] as const,
  );
  let compared = 0;
  let bad = 0;
  let total = 0;
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const e = (y * box.w + x) * 4;
      if ((expected.rgba[e + 3] ?? 0) < 255) continue;
      if (
        drawn.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1)
      )
        continue;
      const s = (y * box.w + x) * 3;
      const diff = [0, 1, 2].map((c) =>
        Math.abs((seen[s + c] ?? 0) - (expected.rgba[e + c] ?? 0)),
      );
      compared++;
      total += ((diff[0] ?? 0) + (diff[1] ?? 0) + (diff[2] ?? 0)) / 3;
      if (Math.max(...diff) > PRODUCT_PIXEL_DELTA) bad++;
    }
  }
  if (compared === 0) return [];
  const mean = total / compared;
  return mean > PRODUCT_MEAN_TOLERANCE || bad / compared > PRODUCT_BAD_SHARE
    ? [
        `product: its pixels differ from the source (mean ${mean.toFixed(1)}, ${Math.round((100 * bad) / compared)}% far off)`,
      ]
    : [];
}
