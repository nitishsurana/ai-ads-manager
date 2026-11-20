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
  type LogoGeometry,
} from "./canvas";
import { DARK_INK, hexOf, LIGHT_INK, type Backdrop, type Rgb } from "./colour";
import { pickCtaColour, type CtaPreference } from "./cta-colour";
import { blockSteps, EYEBROW_LINE, HEADLINE_LINE, type Block } from "./block";
import { fitText, sizeRange, type Fit } from "./fit";
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
  // Whether no loaded font has a glyph of the text.
  unsupported: (text: string) => boolean;
};

export type LayoutInput = {
  copy: Copy;
  // The font versions the faces behind `heading` and `body` were loaded at.
  fonts: Record<string, string>;
  method: Layout["method"];
  product: Box | null;
  // Keeps the eyebrow, headline and CTA at least CLEARANCE px from the product when it can.
  keepClear: boolean;
  badge: BadgeSpec | null;
  offerFactId: string | null;
  heading: FaceInput;
  body: FaceInput;
  // Brand colours the CTA must stay away from: the palette and the logo's inks.
  brandColours: Rgb[];
  // Text colours to try first, before white and near-black.
  brandInks: Rgb[];
  logo: LogoSpec | null;
  // Which logo box and corners to plan with: 2 for a new creative, 1 when an edit re-plans a creative stored before the larger logo.
  logoGeometry: LogoGeometry;
  cta: CtaPreference;
  // The pixels behind a box, with the scrim over them when one is given.
  sample: (box: Box, scrim: Scrim | null) => Backdrop;
};

const CTA_LINE = 1.15;
const CTA_MIN = 24;
const CLEARANCE = 32;

type Edge = Scrim["edge"];
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

  const ctaFit = (maxLines: number) =>
    fitText(copy.cta, body.measure, {
      maxWidth: SAFE_BOX.w - 2 * DESIGN.ctaPadX,
      maxLines,
      sizes: sizeRange(DESIGN.ctaSize, CTA_MIN, 2),
      weight: 700,
    });
  const ctaHeightOf = (fit: Fit) =>
    Math.ceil(
      Math.max(
        DESIGN.ctaHeight,
        fit.lines.length * fit.size * CTA_LINE + 2 * CTA_PAD_Y,
      ),
    );
  const clear = input.keepClear ? input.product : null;
  let label = ctaFit(2);
  if (
    clear &&
    label.lines.length > 1 &&
    CTA_BOTTOM - ctaHeightOf(label) < bottom(clear) + CLEARANCE
  ) {
    const single = ctaFit(1);
    if (single.fits) label = single;
  }
  if (!label.fits) dropped.push({ element: "cta", reason: "does not fit" });
  const labelWidth = Math.max(
    ...label.lines.map((line) => body.measure(line, label.size, 700)),
  );
  const ctaHeight = ctaHeightOf(label);
  const ctaWidth = Math.min(
    SAFE_BOX.w,
    Math.ceil(labelWidth + 2 * DESIGN.ctaPadX),
  );
  const ctaBox: Box = {
    x: centredX(ctaWidth),
    y: CTA_BOTTOM - ctaHeight,
    w: ctaWidth,
    h: ctaHeight,
  };

  const steps = blockSteps(copy, {
    heading: heading.measure,
    body: body.measure,
  });
  const natural =
    input.method === "photo" && input.product
      ? chooseEdge(input.product)
      : "top";
  const topOf = (edge: Edge, block: Block) =>
    edge === "bottom" ? ctaBox.y - 48 - block.height : SAFE_BOX.y;
  const clears = (edge: Edge, block: Block) =>
    clear !== null &&
    (edge === "top"
      ? topOf(edge, block) + block.height + CLEARANCE <= clear.y
      : topOf(edge, block) >= bottom(clear) + CLEARANCE);
  const edges: Edge[] = [natural, natural === "top" ? "bottom" : "top"];
  const placed = edges.flatMap((edge) => {
    const block = steps.find((step) => clears(edge, step));
    return block ? [{ edge, block }] : [];
  })[0];
  const { edge, block } = !clear
    ? { edge: natural, block: steps[0] as Block }
    : (placed ?? { edge: "top" as const, block: steps.at(-1) as Block });
  const { headline: headFit, eyebrow: eyebrowFit, eyebrowHeight } = block;
  if (!headFit.fits) {
    dropped.push({ element: "headline", reason: "does not fit in 3 lines" });
  }
  if (copy.eyebrow && !eyebrowFit) {
    dropped.push({ element: "eyebrow", reason: "does not fit" });
  }
  const blockHeight = block.height;
  const blockTop = topOf(edge, block);

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
  const accent = pickCtaColour({
    ...input.cta,
    brand: input.brandColours,
    network: AD_NETWORK_COLOURS,
    backdrop: sample(ctaBox, scrim),
  });
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
    mode: input.cta.mode,
    box: ctaBox,
  };
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
      geometry: input.logoGeometry,
      sample: (box) => sample(box, scrim),
      avoid,
      measure: heading.measure,
      fontFamily: heading.family,
      fallback: heading.needsFallback,
      unsupported: heading.unsupported,
    });
    logo = placed.logo;
    if (placed.reason) dropped.push({ element: "logo", reason: placed.reason });
  }

  return {
    version: 1,
    ...(input.logoGeometry === 2 && { logoGeometry: 2 as const }),
    offerFactId: input.offerFactId,
    fonts: input.fonts,
    method: input.method,
    product: input.product,
    keepClear: input.keepClear,
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
