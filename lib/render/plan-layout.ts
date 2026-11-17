import { TEXT_MIN_CONTRAST } from "@/lib/config";
import { AD_NETWORK_COLOURS } from "./ad-network";
import { planBadge, type BadgeSpec } from "./badge";
import {
  BLOCK_GAP,
  bottom,
  centredX,
  CTA_BOTTOM,
  DESIGN,
  overlaps,
  right,
  SAFE_BOX,
  type Box,
} from "./canvas";
import { DARK_INK, hexOf, LIGHT_INK, type Backdrop, type Rgb } from "./colour";
import { pickCtaColour } from "./cta-colour";
import { fitText, sizeRange } from "./fit";
import type { Layout, TextLayout } from "./layout";
import { placeLogo, type LogoSpec } from "./logo";
import {
  chooseEdge,
  chooseScrim,
  contrastUnder,
  READABLE,
  scrimOf,
  type Scrim,
} from "./scrim";
import type { Measure } from "./measure";
import type { Copy } from "@/lib/round/types";

export type FaceInput = {
  family: string;
  measure: Measure;
  // Whether the brand font lacks a glyph of the text, so the fallback draws it.
  needsFallback: (text: string) => boolean;
};

export type LayoutInput = {
  copy: Copy;
  // The font versions the faces behind `heading` and `body` were loaded at.
  fonts: Record<string, string>;
  method: Layout["method"];
  product: Box | null;
  badge: BadgeSpec | null;
  offerFactId: string | null;
  heading: FaceInput;
  body: FaceInput;
  // Brand colours the CTA must stay away from: the palette and the logo's inks.
  brandColours: Rgb[];
  // Text colours to try first, before white and near-black.
  brandInks: Rgb[];
  logo: LogoSpec | null;
  // The pixels behind a box, with the scrim over them when one is given.
  sample: (box: Box, scrim: Scrim | null) => Backdrop;
};

const HEADLINE_LINE = 1.05;
const EYEBROW_LINE = 1.2;
const CTA_LINE = 1.15;
const HEADLINE_MIN = 56;
const EYEBROW_MIN = 22;
const CTA_MIN = 24;
const CTA_PAD_Y = 28;
const BADGE_RADIUS = DESIGN.badgeRadius;
const BADGE_OVERHANG = 24;

function textBlock(
  lines: string[],
  size: number,
  lineHeight: number,
  y: number,
  face: FaceInput,
  options: { weight: 400 | 700; tracking: number; colour: Rgb },
): TextLayout {
  const { weight, tracking, colour } = options;
  const width = Math.ceil(
    Math.max(
      ...lines.map((line) => face.measure(line, size, weight, tracking)),
    ),
  );
  const joined = lines.join(" ");
  return {
    box: {
      x: centredX(width),
      y: Math.round(y),
      w: width,
      h: Math.ceil(lines.length * size * lineHeight),
    },
    font: { family: face.family, weight, fallback: face.needsFallback(joined) },
    size,
    colour: hexOf(colour),
    lines,
    lineHeight,
    tracking,
  };
}

// The text sizes and wrapping are decided here from font metrics; Satori only draws what this says.
export function planLayout(input: LayoutInput): Layout {
  const { copy, heading, body, sample } = input;
  const dropped: Layout["dropped"] = [];

  const label = fitText(copy.cta, body.measure, {
    maxWidth: SAFE_BOX.w - 2 * DESIGN.ctaPadX,
    maxLines: 2,
    sizes: sizeRange(DESIGN.ctaSize, CTA_MIN, 2),
    weight: 700,
  });
  if (!label.fits) dropped.push({ element: "cta", reason: "does not fit" });
  const accent = pickCtaColour({
    brand: input.brandColours,
    network: AD_NETWORK_COLOURS,
  });
  const labelWidth = Math.max(
    ...label.lines.map((line) => body.measure(line, label.size, 700)),
  );
  const ctaHeight = Math.ceil(
    Math.max(
      DESIGN.ctaHeight,
      label.lines.length * label.size * CTA_LINE + 2 * CTA_PAD_Y,
    ),
  );
  const ctaWidth = Math.min(
    SAFE_BOX.w,
    Math.ceil(labelWidth + 2 * DESIGN.ctaPadX),
  );
  const cta: Layout["cta"] = {
    ...textBlock(label.lines, label.size, CTA_LINE, 0, body, {
      weight: 700,
      tracking: 0,
      colour: accent.label,
    }),
    background: hexOf(accent.background),
    radius: label.lines.length > 1 ? 36 : Math.round(ctaHeight / 2),
    deltaE: Math.round(accent.deltaE * 10) / 10,
    contrast: Math.round(accent.contrast * 100) / 100,
  };
  cta.box = {
    x: centredX(ctaWidth),
    y: CTA_BOTTOM - ctaHeight,
    w: ctaWidth,
    h: ctaHeight,
  };

  const headFit = fitText(copy.headline, heading.measure, {
    maxWidth: SAFE_BOX.w,
    maxLines: 3,
    sizes: sizeRange(DESIGN.headlineSize, HEADLINE_MIN, 4),
    weight: 700,
  });
  if (!headFit.fits) {
    dropped.push({ element: "headline", reason: "does not fit in 3 lines" });
  }
  const eyebrowFit = copy.eyebrow
    ? [1, 2]
        .map((maxLines) =>
          fitText(copy.eyebrow ?? "", body.measure, {
            maxWidth: SAFE_BOX.w,
            maxLines,
            sizes: sizeRange(DESIGN.eyebrowSize, EYEBROW_MIN, 2),
            weight: 700,
            tracking: DESIGN.eyebrowTracking,
          }),
        )
        .find((fit) => fit.fits)
    : undefined;
  if (copy.eyebrow && !eyebrowFit) {
    dropped.push({ element: "eyebrow", reason: "does not fit" });
  }

  const eyebrowHeight = eyebrowFit
    ? Math.ceil(eyebrowFit.lines.length * eyebrowFit.size * EYEBROW_LINE)
    : 0;
  const headHeight = Math.ceil(
    headFit.lines.length * headFit.size * HEADLINE_LINE,
  );
  const blockHeight = eyebrowHeight + (eyebrowFit ? BLOCK_GAP : 0) + headHeight;
  const edge =
    input.method === "photo" && input.product
      ? chooseEdge(input.product)
      : "top";
  const blockTop =
    edge === "bottom" ? cta.box.y - 48 - blockHeight : SAFE_BOX.y;

  const region = { x: SAFE_BOX.x, y: blockTop, w: SAFE_BOX.w, h: blockHeight };
  const raw = sample(region, null);
  const plain = [...input.brandInks, LIGHT_INK, DARK_INK].find(
    (candidate) => contrastUnder(candidate, raw, null) >= READABLE,
  );
  const chosen = plain
    ? { ink: plain, scrim: null, reached: true }
    : chooseScrim(raw);
  const ink = chosen.ink;
  const scrim: Scrim | null = chosen.scrim
    ? scrimOf(edge, region, chosen.scrim)
    : null;
  const headlineContrast = contrastUnder(ink, raw, chosen.scrim);
  if (headlineContrast < TEXT_MIN_CONTRAST) {
    dropped.push({
      element: "headline",
      reason: `contrast ${headlineContrast.toFixed(2)} stays under ${TEXT_MIN_CONTRAST}:1`,
    });
  }
  const eyebrow = eyebrowFit
    ? textBlock(
        eyebrowFit.lines,
        eyebrowFit.size,
        EYEBROW_LINE,
        blockTop,
        body,
        {
          weight: 700,
          tracking: DESIGN.eyebrowTracking,
          colour: ink,
        },
      )
    : null;
  const headline = {
    ...textBlock(
      headFit.lines,
      headFit.size,
      HEADLINE_LINE,
      blockTop + (eyebrowFit ? eyebrowHeight + BLOCK_GAP : 0),
      heading,
      { weight: 700, tracking: 0, colour: ink },
    ),
    contrast: Math.round(headlineContrast * 100) / 100,
  };

  const avoid: Box[] = [
    headline.box,
    cta.box,
    ...(eyebrow ? [eyebrow.box] : []),
  ];

  let badge: Layout["badge"] = null;
  if (input.badge) {
    const planned = planBadge(input.badge, body.measure);
    if (!planned.ok) {
      dropped.push({ element: "badge", reason: planned.reason });
    } else if (!input.product) {
      dropped.push({ element: "badge", reason: "no product box to sit on" });
    } else {
      const placed = placeBadge(
        planned.w,
        planned.h,
        input.product,
        avoid,
        cta.box.y,
      );
      badge = {
        kind: input.badge.kind,
        box: placed,
        font: {
          family: body.family,
          weight: 700,
          fallback: body.needsFallback(
            planned.rows.map((r) => r.text).join(" "),
          ),
        },
        background: cta.background,
        colour: cta.colour,
        radius: BADGE_RADIUS,
        rows: planned.rows,
      };
      avoid.push(placed);
    }
  }

  let logo: Layout["logo"] = null;
  if (input.logo) {
    const placed = placeLogo(input.logo, {
      sample: (box) => sample(box, scrim),
      avoid,
      measure: heading.measure,
      fontFamily: heading.family,
      fallback: heading.needsFallback,
    });
    logo = placed.logo;
    if (placed.reason) dropped.push({ element: "logo", reason: placed.reason });
  }

  return {
    version: 1,
    offerFactId: input.offerFactId,
    fonts: input.fonts,
    method: input.method,
    product: input.product,
    scrim,
    eyebrow,
    headline,
    cta,
    badge,
    logo,
    dropped,
  };
}

// Top-right of the product, overhanging its corner, and moved down past any text it would cover.
function placeBadge(
  w: number,
  h: number,
  product: Box,
  avoid: Box[],
  ctaTop: number,
): Box {
  const x = Math.min(right(product) + BADGE_OVERHANG, right(SAFE_BOX)) - w;
  let y = Math.max(SAFE_BOX.y, product.y + BADGE_OVERHANG);
  for (let pass = 0; pass < avoid.length; pass++) {
    const hit = avoid.find((box) => overlaps({ x, y, w, h }, box));
    if (!hit) break;
    y = bottom(hit) + 16;
  }
  return {
    x,
    y: Math.round(Math.min(y, ctaTop - h - 16)),
    w,
    h,
  };
}
