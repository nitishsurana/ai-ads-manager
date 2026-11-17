import { LOGO_MAX_WIDTH_SHARE } from "@/lib/config";

export const CANVAS = { width: 1080, height: 1920 } as const;

// The spec's safe margins beat the design's offsets.
export const SAFE = { x: 65, top: 192, bottom: 192 } as const;

export type Box = { x: number; y: number; w: number; h: number };

export const SAFE_BOX: Box = {
  x: SAFE.x,
  y: SAFE.top,
  w: CANVAS.width - 2 * SAFE.x,
  h: CANVAS.height - SAFE.top - SAFE.bottom,
};

export const right = (box: Box) => box.x + box.w;
export const bottom = (box: Box) => box.y + box.h;

export const insideSafe = (box: Box) =>
  box.x >= SAFE_BOX.x &&
  box.y >= SAFE_BOX.y &&
  right(box) <= right(SAFE_BOX) &&
  bottom(box) <= bottom(SAFE_BOX);

export const overlaps = (a: Box, b: Box) =>
  a.x < right(b) && b.x < right(a) && a.y < bottom(b) && b.y < bottom(a);

export const centredX = (width: number) =>
  Math.round((CANVAS.width - width) / 2);

// Creative.dc.html is drawn on a 360-wide canvas in container-query units; one unit is 1% of the width.
const CQW = CANVAS.width / 100;

// Type scale and zone sizes from the design, in canvas pixels.
export const DESIGN = {
  eyebrowSize: 3.4 * CQW,
  eyebrowTracking: 0.14,
  headlineSize: 10.5 * CQW,
  ctaSize: 4.6 * CQW,
  ctaHeight: 11.5 * CQW,
  ctaPadX: 8 * CQW,
  badgePrice: 6.4 * CQW,
  badgeSub: 3.4 * CQW,
  badgePadX: 3 * CQW,
  badgePadY: 2 * CQW,
  badgeRadius: 2.4 * CQW,
} as const;

// Where the product sits: between the headline block and the CTA, about half the frame.
export const PRODUCT_ZONE: Box = { x: 65, y: 690, w: 950, h: 770 };
export const PRODUCT_MAX = { w: 680, h: 770 } as const;

export const CTA_BOTTOM = 1624;
export const BLOCK_GAP = 32;

export const LOGO_MAX_WIDTH = Math.floor(CANVAS.width * LOGO_MAX_WIDTH_SHARE);
export const LOGO_MAX_HEIGHT = 72;
