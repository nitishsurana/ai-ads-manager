import { TEXT_MIN_CONTRAST } from "@/lib/config";
import {
  contrast,
  DARK_INK,
  LIGHT_INK,
  toHex,
  type Backdrop,
  type Rgb,
} from "./colour";
import { bottom, CANVAS, type Box } from "./canvas";
import type { Layout } from "./layout";

export type Scrim = NonNullable<Layout["scrim"]>;
type Edge = Scrim["edge"];

// A little above the minimum, so a rounding step can't land under it.
export const READABLE = TEXT_MIN_CONTRAST + 0.25;
const STEP = 0.05;
const MAX_OPACITY = 0.8;
const SOLID_PAD = 40;
const FADE = 220;

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

// The side of the product with more free room runs the headline; a tie goes to the top.
export function chooseEdge(product: Box): Edge {
  return product.y >= CANVAS.height - bottom(product) ? "top" : "bottom";
}

const blend = (colour: Rgb, over: Rgb, opacity: number): Rgb => [
  colour[0] * (1 - opacity) + over[0] * opacity,
  colour[1] * (1 - opacity) + over[1] * opacity,
  colour[2] * (1 - opacity) + over[2] * opacity,
];

// The ink's contrast on the area's darkest and lightest pixels once the scrim is over them.
export function contrastUnder(
  ink: Rgb,
  backdrop: Backdrop,
  scrim: { colour: Rgb; opacity: number } | null,
) {
  const under = (colour: Rgb) =>
    scrim ? blend(colour, scrim.colour, scrim.opacity) : colour;
  return Math.min(
    contrast(ink, under(backdrop.dark)),
    contrast(ink, under(backdrop.light)),
  );
}

function lowestOpacity(ink: Rgb, over: Rgb, backdrop: Backdrop) {
  for (let opacity = 0; opacity <= MAX_OPACITY + 1e-9; opacity += STEP) {
    const rounded = Math.round(opacity * 100) / 100;
    if (
      contrastUnder(ink, backdrop, { colour: over, opacity: rounded }) >=
      READABLE
    ) {
      return rounded;
    }
  }
  return null;
}

export type ScrimChoice = {
  ink: Rgb;
  // Null when the area already reads without one.
  scrim: { colour: Rgb; opacity: number } | null;
  // False when even the strongest scrim stays under the target.
  reached: boolean;
};

// White ink under a black scrim, or dark ink under a white one: whichever needs the lighter scrim (0 means none).
export function chooseScrim(backdrop: Backdrop): ScrimChoice {
  const options = [
    {
      ink: LIGHT_INK,
      over: BLACK,
      opacity: lowestOpacity(LIGHT_INK, BLACK, backdrop),
    },
    {
      ink: DARK_INK,
      over: WHITE,
      opacity: lowestOpacity(DARK_INK, WHITE, backdrop),
    },
  ];
  const reaching = options.filter((option) => option.opacity !== null);
  const lowest = Math.min(...reaching.map((option) => option.opacity ?? 0));
  const tied = reaching.filter((option) => option.opacity === lowest);
  const darkArea = backdrop.mean[0] + backdrop.mean[1] + backdrop.mean[2] < 384;
  const pick =
    tied.find((option) => (option.ink === LIGHT_INK) === darkArea) ?? tied[0];
  if (pick) {
    const opacity = pick.opacity ?? 0;
    return {
      ink: pick.ink,
      scrim: opacity > 0 ? { colour: pick.over, opacity } : null,
      reached: true,
    };
  }
  const strongest =
    options
      .map((option) => ({
        ...option,
        ratio: contrastUnder(option.ink, backdrop, {
          colour: option.over,
          opacity: MAX_OPACITY,
        }),
      }))
      .sort((a, b) => b.ratio - a.ratio)[0] ?? options[0];
  return {
    ink: strongest?.ink ?? LIGHT_INK,
    scrim: { colour: strongest?.over ?? BLACK, opacity: MAX_OPACITY },
    reached: false,
  };
}

// Full width from the canvas edge to 40 px past the text block, then a 220 px fade.
export function scrimBox(edge: Edge, block: Box): Box {
  if (edge === "top") {
    return { x: 0, y: 0, w: CANVAS.width, h: bottom(block) + SOLID_PAD + FADE };
  }
  const y = Math.max(0, block.y - SOLID_PAD - FADE);
  return { x: 0, y, w: CANVAS.width, h: CANVAS.height - y };
}

export function scrimSvg({ edge, box, opacity, colour }: Scrim) {
  const [from, to] = edge === "top" ? [0, 1] : [1, 0];
  const solid = (box.h - FADE) / box.h;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}">` +
      `<defs><linearGradient id="g" x1="0" y1="${from}" x2="0" y2="${to}">` +
      `<stop offset="0" stop-color="${colour}" stop-opacity="${opacity}"/>` +
      `<stop offset="${solid}" stop-color="${colour}" stop-opacity="${opacity}"/>` +
      `<stop offset="1" stop-color="${colour}" stop-opacity="0"/>` +
      `</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
}

// The scrim's opacity on canvas row y: full through the solid part, then a linear fade.
export function scrimOpacityAt({ edge, box, opacity }: Scrim, y: number) {
  const inside = y - box.y;
  if (inside < 0 || inside > box.h) return 0;
  const fromEdge = edge === "top" ? inside : box.h - inside;
  const solid = box.h - FADE;
  return fromEdge <= solid ? opacity : (opacity * (box.h - fromEdge)) / FADE;
}

export const scrimOf = (
  edge: Edge,
  block: Box,
  choice: { colour: Rgb; opacity: number },
): Scrim => ({
  edge,
  box: scrimBox(edge, block),
  opacity: choice.opacity,
  colour: toHex(choice.colour),
});
