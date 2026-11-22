import { LOGO_MIN_CONTRAST } from "@/lib/config";
import {
  bestInk,
  DARK_INK,
  deltaE,
  flatBackdrop,
  LIGHT_INK,
  logoLegibility,
  toHex,
  worstContrast,
  worstOf,
  type Backdrop,
  type Rgb,
} from "./colour";
import {
  overlaps,
  type Box,
  type LogoGeometry,
  type RuleVersion,
} from "./canvas";
import type { LogoLayout } from "./layout";
import {
  CORNERS,
  cornerBox,
  imageSize,
  panelAround,
  PANEL_RADIUS,
  round,
  type Corner,
} from "./logo-box";
import { neutralPanel } from "./logo-panel";
import { wordmarkLayout } from "./logo-wordmark";
import type { Measure } from "./measure";

export type LogoSpec = {
  kind: "image" | "wordmark";
  // Width over height of the image; ignored for a wordmark.
  aspect: number;
  colourClass: "one_colour" | "current_colour" | "multi_colour" | null;
  colours: Rgb[];
  // Each colour's share of the logo's ink, in the same order; absent for a logo stored without them.
  shares?: number[];
  headerBackground: Rgb | null;
  // A disc or sticker with its own field: drawn as it is, never recoloured or checked for contrast.
  badge: boolean;
  // The text a wordmark logo draws, and what an image logo falls back to under geometry 1: the logo's own, or the brand name.
  wordmark: string | null;
  // The brand's primary colour, tried first for a wordmark.
  brandInk: Rgb | null;
};

export type LogoContext = {
  geometry: LogoGeometry;
  rule: RuleVersion;
  sample: (box: Box) => Backdrop;
  // Boxes the logo must not cover when it moves to another corner.
  avoid: Box[];
  measure: Measure;
  fontFamily: string;
  // Whether the brand font draws the wordmark itself.
  fallback: (text: string) => boolean;
  // Whether no loaded font has a glyph of the text.
  unsupported: (text: string) => boolean;
};

function oneColour(spec: LogoSpec, context: LogoContext): LogoLayout | null {
  const { geometry } = context;
  const { w, h } = imageSize(spec.aspect, geometry);
  const box = cornerBox("bottom_right", w, h, geometry);
  const backdrop = context.sample(box);
  const own = spec.colourClass === "one_colour" ? spec.colours[0] : undefined;
  const ownRatio = own ? worstContrast(own, backdrop) : 0;
  const best = bestInk([LIGHT_INK, DARK_INK], backdrop);
  const asIs = own !== undefined && ownRatio >= LOGO_MIN_CONTRAST;
  if (!asIs && best.ratio < LOGO_MIN_CONTRAST) return null;
  const ink = asIs ? own : best.ink;
  return {
    kind: "image",
    box,
    decision: asIs ? "as_is" : "recoloured",
    corner: "bottom_right",
    // A currentColor logo is stored black, so it is always drawn in its chosen ink.
    ink: asIs ? null : toHex(ink),
    contrast: round(asIs ? ownRatio : best.ratio),
    panel: null,
    wordmark: null,
  };
}

function multiColour(spec: LogoSpec, context: LogoContext): LogoLayout | null {
  const { geometry } = context;
  const { w, h } = imageSize(spec.aspect, geometry);
  const colours = spec.colours.length > 0 ? spec.colours : [DARK_INK];
  const read = (backdrop: Backdrop) => {
    if (context.rule === 2) {
      return logoLegibility(colours, spec.shares, backdrop);
    }
    const ratio = worstOf(colours, backdrop);
    return { legible: ratio >= LOGO_MIN_CONTRAST, ratio };
  };
  const place = (corner: Corner) => {
    const box = cornerBox(corner, w, h, geometry);
    return { corner, box, ...read(context.sample(box)) };
  };
  const base = (
    decision: LogoLayout["decision"],
    p: Pick<ReturnType<typeof place>, "corner" | "box" | "ratio">,
  ) => ({
    kind: "image" as const,
    box: p.box,
    decision,
    corner: p.corner,
    ink: null,
    contrast: round(p.ratio),
    panel: null,
    wordmark: null,
  });

  const home = place("bottom_right");
  if (home.legible) return base("as_is", home);

  const calmer = CORNERS.slice(1)
    .map(place)
    .filter(
      (p) => p.legible && !context.avoid.some((box) => overlaps(box, p.box)),
    )
    .map((p) => ({ p, busy: context.sample(p.box).busy }))
    .sort((a, b) => a.busy - b.busy)[0];
  if (calmer) return base("calmer_corner", calmer.p);

  const panelColour = spec.headerBackground;
  const onPanel = panelColour && read(flatBackdrop(panelColour));
  if (panelColour && onPanel?.legible) {
    const { panel, inner } = panelAround(w, h, geometry);
    return {
      ...base("header_panel", {
        corner: "bottom_right",
        box: inner,
        ratio: onPanel.ratio,
      }),
      panel: { box: panel, colour: toHex(panelColour), radius: PANEL_RADIUS },
    };
  }
  return null;
}

// Below this the badge's own field is the same colour as what is behind it, so its outline vanishes.
const BADGE_MIN_DELTA_E = 20;

// A badge keeps its own field, so it is drawn as it is in the home corner unless that field blends into the backdrop; its contrast, the dominant colour against what is behind it, is recorded only for information.
function badge(spec: LogoSpec, context: LogoContext): LogoLayout {
  const { geometry } = context;
  const { w, h } = imageSize(spec.aspect, geometry);
  const box = cornerBox("bottom_right", w, h, geometry);
  const backdrop = context.sample(box);
  const field = spec.colours[0] ?? DARK_INK;
  if (deltaE(field, backdrop.mean) < BADGE_MIN_DELTA_E) {
    return neutral(spec, context);
  }
  return {
    kind: "image",
    box,
    decision: "badge",
    corner: "bottom_right",
    ink: null,
    contrast: round(worstContrast(field, backdrop)),
    panel: null,
    wordmark: null,
  };
}

function neutral(spec: LogoSpec, context: LogoContext): LogoLayout {
  const { geometry } = context;
  const { w, h } = imageSize(spec.aspect, geometry);
  const multi = spec.colourClass === "multi_colour";
  const placed = neutralPanel(
    w,
    h,
    geometry,
    multi
      ? {
          colours: spec.colours.length > 0 ? spec.colours : [DARK_INK],
          shares: spec.shares,
          rule: context.rule,
        }
      : null,
  );
  return {
    kind: "image",
    box: placed.inner,
    decision: "panel",
    corner: "bottom_right",
    ink: placed.ink,
    contrast: round(placed.contrast),
    panel: placed.panel,
    wordmark: null,
  };
}

// Geometry 2, an image logo: the logo as it is (a badge always) or recoloured; a multi-colour logo may then move to a calmer corner or take a header-colour panel; a neutral panel last, so an image logo is always drawn and never turns into text.
function imageLogo(spec: LogoSpec, context: LogoContext): LogoLayout {
  if (spec.badge && spec.colourClass === "multi_colour") {
    return badge(spec, context);
  }
  const image =
    spec.colourClass === "multi_colour"
      ? multiColour(spec, context)
      : oneColour(spec, context);
  return image ?? neutral(spec, context);
}

// Geometry 1 is the chain creatives stored before the larger logo keep: the logo as it is or recoloured; then (multi-colour only) another corner, then a header-colour panel; then the wordmark; then nothing. The reason names why the logo itself was not used.
function legacyLogo(spec: LogoSpec, context: LogoContext) {
  const image =
    spec.colourClass === "multi_colour"
      ? multiColour(spec, context)
      : oneColour(spec, context);
  if (image) return { logo: image, reason: null };
  const wordmark = wordmarkLayout(spec, context);
  const why = "the logo lacks contrast anywhere";
  return "layout" in wordmark
    ? { logo: wordmark.layout, reason: why }
    : { logo: null, reason: `${why}; ${wordmark.reason}; no logo is drawn` };
}

export function placeLogo(
  spec: LogoSpec,
  context: LogoContext,
): { logo: LogoLayout | null; reason: string | null } {
  if (spec.kind === "wordmark") {
    const wordmark = wordmarkLayout(spec, context);
    return "layout" in wordmark
      ? { logo: wordmark.layout, reason: null }
      : { logo: null, reason: `${wordmark.reason}; no logo is drawn` };
  }
  if (context.geometry === 1) return legacyLogo(spec, context);
  return { logo: imageLogo(spec, context), reason: null };
}
