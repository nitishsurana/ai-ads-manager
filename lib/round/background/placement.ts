import { CANVAS, PRODUCT_MAX, PRODUCT_ZONE, type Box } from "@/lib/render";

// Bria edits a canvas 8 px wider than the ad (its size must be a multiple of 16); the extra 4 px each side are cropped after.
export const EDIT_WIDTH = 1088;
export const EDIT_MARGIN = (EDIT_WIDTH - CANVAS.width) / 2;

// The product, trimmed to its outline, scaled to the largest size that fits the product zone and centred in it.
export function placeProduct(width: number, height: number): Box {
  const scale = Math.min(PRODUCT_MAX.w / width, PRODUCT_MAX.h / height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return {
    x: Math.floor((CANVAS.width - w) / 2),
    y: Math.round(PRODUCT_ZONE.y + (PRODUCT_ZONE.h - h) / 2),
    w,
    h,
  };
}
