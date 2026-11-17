import { LOGO_MIN_CONTRAST } from "@/lib/config";
import {
  bestInk,
  contrast,
  DARK_INK,
  flatBackdrop,
  LIGHT_INK,
  toHex,
  worstContrast,
  type Backdrop,
  type Rgb,
} from "./colour";
import {
  bottom,
  LOGO_MAX_HEIGHT,
  LOGO_MAX_WIDTH,
  overlaps,
  right,
  SAFE_BOX,
  type Box,
} from "./canvas";
import type { LogoLayout } from "./layout";
import type { Measure } from "./measure";

export type LogoSpec = {
  kind: "image" | "wordmark";
  // Width over height of the image; ignored for a wordmark.
  aspect: number;
  colourClass: "one_colour" | "current_colour" | "multi_colour" | null;
  colours: Rgb[];
  headerBackground: Rgb | null;
  // The text a wordmark falls back to: the logo's own, or the brand name.
  wordmark: string | null;
  // The brand's primary colour, tried first for a wordmark.
  brandInk: Rgb | null;
};

export type LogoContext = {
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

type Corner = LogoLayout["corner"];

const PANEL_PAD = 14;
const PANEL_RADIUS = 14;
const WORDMARK_SIZE = 44;
// Below this height a wordmark is a smudge; it is dropped instead.
const WORDMARK_MIN_HEIGHT = 28;
const CORNERS: readonly Corner[] = [
  "bottom_right",
  "bottom_left",
  "top_right",
  "top_left",
];

function imageSize(aspect: number) {
  const h = Math.min(LOGO_MAX_HEIGHT, LOGO_MAX_WIDTH / aspect);
  return { w: Math.round(h * aspect), h: Math.round(h) };
}

function cornerBox(corner: Corner, w: number, h: number): Box {
  const x = corner.endsWith("right") ? right(SAFE_BOX) - w : SAFE_BOX.x;
  const y = corner.startsWith("bottom") ? bottom(SAFE_BOX) - h : SAFE_BOX.y;
  return { x, y, w, h };
}

const worstOf = (colours: readonly Rgb[], backdrop: Backdrop) =>
  Math.min(
    Infinity,
    ...colours.map((colour) => worstContrast(colour, backdrop)),
  );

type Wordmark = { layout: LogoLayout } | { reason: string };

// One line at the largest size that fits the cap; a name too wide for that at the smallest legible size is split into two balanced lines instead.
function fitWordmark(text: string, context: LogoContext) {
  const lineHeight = (size: number) => Math.ceil(size * 1.2);
  const widest = (lines: string[], size: number) =>
    Math.ceil(
      Math.max(...lines.map((line) => context.measure(line, size, 700))),
    );
  const shrink = (lines: string[], from: number) => {
    let size = from;
    while (
      lineHeight(size - 2) >= WORDMARK_MIN_HEIGHT &&
      widest(lines, size) > LOGO_MAX_WIDTH
    ) {
      size -= 2;
    }
    return size;
  };
  let size = shrink([text], WORDMARK_SIZE);
  if (widest([text], size) <= LOGO_MAX_WIDTH) {
    return { lines: [text], size, single: true };
  }

  const words = text.split(/\s+/);
  const splits = words
    .slice(1)
    .map((_, i) => [
      words.slice(0, i + 1).join(" "),
      words.slice(i + 1).join(" "),
    ]);
  const best = splits.reduce<string[] | null>(
    (pick, lines) =>
      !pick || widest(lines, size) < widest(pick, size) ? lines : pick,
    null,
  );
  if (!best) return { lines: [text], size, single: true };
  size = shrink(
    best,
    Math.min(WORDMARK_SIZE, Math.floor(LOGO_MAX_HEIGHT / 2.4)),
  );
  return { lines: best, size, single: false };
}

function wordmarkLayout(spec: LogoSpec, context: LogoContext): Wordmark {
  const text = spec.wordmark;
  if (!text) return { reason: "there is no wordmark text" };
  if (context.unsupported(text)) {
    return { reason: "no font has every glyph of the wordmark" };
  }
  const { lines, size, single } = fitWordmark(text, context);
  const w = Math.ceil(
    Math.max(...lines.map((line) => context.measure(line, size, 700))),
  );
  const h = Math.ceil(size * 1.2) * lines.length;
  if (w > LOGO_MAX_WIDTH) {
    return {
      reason: `the wordmark needs ${w} px, over the ${LOGO_MAX_WIDTH} px cap, at its smallest legible size${single ? " (a single word can't be split)" : ", even on two lines"}`,
    };
  }
  const box = cornerBox("bottom_right", w, h);
  const backdrop = context.sample(box);
  const own =
    spec.brandInk &&
    worstContrast(spec.brandInk, backdrop) >= LOGO_MIN_CONTRAST;
  const { ink, ratio } = own
    ? {
        ink: spec.brandInk as Rgb,
        ratio: worstContrast(spec.brandInk as Rgb, backdrop),
      }
    : bestInk([LIGHT_INK, DARK_INK], backdrop);
  if (ratio < LOGO_MIN_CONTRAST) {
    return { reason: "the wordmark lacks contrast" };
  }
  return {
    layout: {
      kind: "wordmark",
      box,
      decision: "wordmark",
      corner: "bottom_right",
      ink: toHex(ink),
      contrast: round(ratio),
      panel: null,
      wordmark: {
        text,
        lines,
        font: {
          family: context.fontFamily,
          weight: 700,
          fallback: context.fallback(text),
        },
        size,
      },
    },
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

function oneColour(spec: LogoSpec, context: LogoContext): LogoLayout | null {
  const { w, h } = imageSize(spec.aspect);
  const box = cornerBox("bottom_right", w, h);
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
  const { w, h } = imageSize(spec.aspect);
  const colours = spec.colours.length > 0 ? spec.colours : [DARK_INK];
  const place = (corner: Corner) => {
    const box = cornerBox(corner, w, h);
    return { corner, box, ratio: worstOf(colours, context.sample(box)) };
  };
  const base = (
    decision: LogoLayout["decision"],
    p: ReturnType<typeof place>,
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
  if (home.ratio >= LOGO_MIN_CONTRAST) return base("as_is", home);

  const calmer = CORNERS.slice(1)
    .map(place)
    .filter(
      (p) =>
        p.ratio >= LOGO_MIN_CONTRAST &&
        !context.avoid.some((box) => overlaps(box, p.box)),
    )
    .map((p) => ({ p, busy: context.sample(p.box).busy }))
    .sort((a, b) => a.busy - b.busy)[0];
  if (calmer) return base("calmer_corner", calmer.p);

  const panelColour = spec.headerBackground;
  if (
    panelColour &&
    worstOf(colours, flatBackdrop(panelColour)) >= LOGO_MIN_CONTRAST
  ) {
    const panelBox = cornerBox(
      "bottom_right",
      w + 2 * PANEL_PAD,
      h + 2 * PANEL_PAD,
    );
    return {
      ...base("header_panel", {
        corner: "bottom_right",
        box: {
          x: panelBox.x + PANEL_PAD,
          y: panelBox.y + PANEL_PAD,
          w,
          h,
        },
        ratio: Math.min(...colours.map((c) => contrast(c, panelColour))),
      }),
      panel: {
        box: panelBox,
        colour: toHex(panelColour),
        radius: PANEL_RADIUS,
      },
    };
  }
  return null;
}

// The chain: the logo as it is or recoloured; then (multi-colour only) another corner, then a header-colour panel; then the wordmark; then nothing. The reason names why the logo itself was not used.
export function placeLogo(
  spec: LogoSpec,
  context: LogoContext,
): { logo: LogoLayout | null; reason: string | null } {
  if (spec.kind === "image") {
    const image =
      spec.colourClass === "multi_colour"
        ? multiColour(spec, context)
        : oneColour(spec, context);
    if (image) return { logo: image, reason: null };
  }
  const wordmark = wordmarkLayout(spec, context);
  const why = spec.kind === "image" ? "the logo lacks contrast anywhere; " : "";
  return "layout" in wordmark
    ? {
        logo: wordmark.layout,
        reason: spec.kind === "image" ? why.replace(/; $/, "") : null,
      }
    : { logo: null, reason: `${why}${wordmark.reason}; no logo is drawn` };
}
