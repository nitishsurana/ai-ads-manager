import {
  BOTTOM_LOGO_BOX,
  bottom,
  LOGO_LIMITS,
  right,
  SAFE_BOX,
  type Box,
  type LogoGeometry,
} from "./canvas";
import type { LogoLayout } from "./layout";

export type Corner = LogoLayout["corner"];

export const CORNERS: readonly Corner[] = [
  "bottom_right",
  "bottom_left",
  "top_right",
  "top_left",
];

export const PANEL_PAD = 14;
export const PANEL_RADIUS = 14;

export const round = (value: number) => Math.round(value * 100) / 100;

export function imageSize(aspect: number, geometry: LogoGeometry) {
  const { width, height } = LOGO_LIMITS[geometry];
  const h = Math.min(height, width / aspect);
  return { w: Math.round(h * aspect), h: Math.round(h) };
}

export function cornerBox(
  corner: Corner,
  w: number,
  h: number,
  geometry: LogoGeometry,
): Box {
  const area =
    geometry === 2 && corner.startsWith("bottom") ? BOTTOM_LOGO_BOX : SAFE_BOX;
  const x = corner.endsWith("right") ? right(area) - w : area.x;
  const y = corner.startsWith("bottom") ? bottom(area) - h : area.y;
  return { x, y, w, h };
}

// A panel PANEL_PAD around a logo of this size in the bottom-right corner, and where the logo sits inside it.
export function panelAround(w: number, h: number, geometry: LogoGeometry) {
  const panel = cornerBox(
    "bottom_right",
    w + 2 * PANEL_PAD,
    h + 2 * PANEL_PAD,
    geometry,
  );
  return {
    panel,
    inner: { x: panel.x + PANEL_PAD, y: panel.y + PANEL_PAD, w, h },
  };
}
