import {
  bestInk,
  contrast,
  DARK_INK,
  flatBackdrop,
  LIGHT_INK,
  logoLegibility,
  toHex,
  worstOf,
  type Rgb,
} from "./colour";
import type { LogoGeometry, RuleVersion } from "./canvas";
import { panelAround, PANEL_RADIUS } from "./logo-box";

const PANELS: readonly Rgb[] = [LIGHT_INK, DARK_INK];

type Multi = {
  colours: readonly Rgb[];
  shares?: readonly number[];
  rule: RuleVersion;
};

// The last resort for a logo: a plain white or near-black panel in the bottom-right corner. A logo drawn in one ink gets the panel its best light or dark ink reads on most; with `multi` the logo keeps its colours. Rule 1 takes the panel that gives the worst of them the most contrast; rule 2 the one where they are legible by share, else the one that reads the dominant colour best. `contrast` is the dominant colour's.
export function neutralPanel(
  w: number,
  h: number,
  geometry: LogoGeometry,
  multi: Multi | null,
) {
  const picks = PANELS.map((colour) => {
    const backdrop = flatBackdrop(colour);
    if (!multi)
      return {
        colour,
        legible: true,
        ...bestInk([LIGHT_INK, DARK_INK], backdrop),
      };
    if (multi.rule === 2) {
      return {
        colour,
        ink: null,
        ...logoLegibility(multi.colours, multi.shares, backdrop),
      };
    }
    const ratio = worstOf(multi.colours, backdrop);
    return { colour, ink: null, legible: true, ratio };
  });
  const best = picks.reduce((pick, next) =>
    (next.legible && !pick.legible) ||
    (next.legible === pick.legible && next.ratio > pick.ratio)
      ? next
      : pick,
  );
  const { panel, inner } = panelAround(w, h, geometry);
  return {
    inner,
    panel: { box: panel, colour: toHex(best.colour), radius: PANEL_RADIUS },
    ink: best.ink ? toHex(best.ink) : null,
    contrast:
      multi?.rule === 1
        ? contrast(multi.colours[0] ?? DARK_INK, best.colour)
        : best.ratio,
  };
}
