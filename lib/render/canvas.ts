import {
  LEGACY_LOGO_MAX_WIDTH_SHARE,
  LOGO_MAX_WIDTH_SHARE,
} from "@/lib/config";

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

const inside = (outer: Box, box: Box) =>
  box.x >= outer.x &&
  box.y >= outer.y &&
  right(box) <= right(outer) &&
  bottom(box) <= bottom(outer);

export const insideSafe = (box: Box) => inside(SAFE_BOX, box);

// Logo geometry 2 sits the bottom corners closer to the edges than the safe margins: 48 px from the side, 96 px from the bottom. Geometry 1 is what creatives stored before that keep on edit.
export type LogoGeometry = 1 | 2;
export const LOGO_INSET = { side: 48, bottom: 96 } as const;
export const BOTTOM_LOGO_BOX: Box = {
  x: LOGO_INSET.side,
  y: SAFE.top,
  w: CANVAS.width - 2 * LOGO_INSET.side,
  h: CANVAS.height - LOGO_INSET.bottom - SAFE.top,
};

export const LOGO_LIMITS = {
  1: {
    width: Math.floor(CANVAS.width * LEGACY_LOGO_MAX_WIDTH_SHARE),
    height: 72,
    wordmarkSize: 44,
  },
  2: {
    width: Math.floor(CANVAS.width * LOGO_MAX_WIDTH_SHARE),
    height: 132,
    wordmarkSize: 56,
  },
} as const;

export const insideLogoArea = (box: Box, geometry: LogoGeometry) =>
  insideSafe(box) || (geometry === 2 && inside(BOTTOM_LOGO_BOX, box));

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
// Where an isolated product sits in a whole photo: room for the smallest text block above it, and clear of the CTA below.
export const PHOTO_PRODUCT_ZONE: Box = { x: 65, y: 500, w: 950, h: 968 };

export const CTA_BOTTOM = 1624;
export const BLOCK_GAP = 32;
