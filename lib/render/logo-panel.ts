import {
  bestInk,
  contrast,
  DARK_INK,
  flatBackdrop,
  LIGHT_INK,
  toHex,
  worstOf,
  type Rgb,
} from "./colour";
import type { LogoGeometry } from "./canvas";
import { panelAround, PANEL_RADIUS } from "./logo-box";

const PANELS: readonly Rgb[] = [LIGHT_INK, DARK_INK];

// The last resort for a logo: a plain white or near-black panel in the bottom-right corner. A logo drawn in one ink gets the panel its best light or dark ink reads on most; with `colours` the logo keeps them, on the panel that gives the worst of them the most contrast, and `contrast` is the dominant colour's.
export function neutralPanel(
  w: number,
  h: number,
  geometry: LogoGeometry,
  colours: readonly Rgb[] | null,
) {
  const picks = PANELS.map((colour) => {
    const backdrop = flatBackdrop(colour);
    return colours
      ? { colour, ink: null, ratio: worstOf(colours, backdrop) }
      : { colour, ...bestInk([LIGHT_INK, DARK_INK], backdrop) };
  });
  const best = picks.reduce((pick, next) =>
    next.ratio > pick.ratio ? next : pick,
  );
  const { panel, inner } = panelAround(w, h, geometry);
  return {
    inner,
    panel: { box: panel, colour: toHex(best.colour), radius: PANEL_RADIUS },
    ink: best.ink ? toHex(best.ink) : null,
    contrast: colours
      ? contrast(colours[0] ?? DARK_INK, best.colour)
      : best.ratio,
  };
}
