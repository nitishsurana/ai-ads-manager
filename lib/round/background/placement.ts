import type { BriefSettings } from "@/lib/brief/schema";
import { CANVAS, PRODUCT_MAX, PRODUCT_ZONE, type Box } from "@/lib/render";

// Bria edits a canvas 8 px wider than the ad (its size must be a multiple of 16); the extra 4 px each side are cropped after.
export const EDIT_WIDTH = 1088;
export const EDIT_MARGIN = (EDIT_WIDTH - CANVAS.width) / 2;

const SMALLER = 0.75;

export function productLimit(size: BriefSettings["productSize"] = "normal") {
  const share = size === "smaller" ? SMALLER : 1;
  return { w: PRODUCT_MAX.w * share, h: PRODUCT_MAX.h * share };
}

// The product, trimmed to its outline, scaled to the largest size that fits the product zone and centred in it.
export function placeProduct(
  width: number,
  height: number,
  size?: BriefSettings["productSize"],
): Box {
  const limit = productLimit(size);
  const scale = Math.min(limit.w / width, limit.h / height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return {
    x: Math.floor((CANVAS.width - w) / 2),
    y: Math.round(PRODUCT_ZONE.y + (PRODUCT_ZONE.h - h) / 2),
    w,
    h,
  };
}
