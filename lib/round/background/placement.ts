import type { BriefSettings } from "@/lib/brief/schema";
import {
  BADGE_ROOM,
  CANVAS,
  PRODUCT_MAX,
  PRODUCT_ZONE,
  type Box,
} from "@/lib/render";

// Bria edits a canvas 8 px wider than the ad (its size must be a multiple of 16); the extra 4 px each side are cropped after.
export const EDIT_WIDTH = 1088;
export const EDIT_MARGIN = (EDIT_WIDTH - CANVAS.width) / 2;

const SMALLER = 0.75;

export function productLimit(size: BriefSettings["productSize"] = "normal") {
  const share = size === "smaller" ? SMALLER : 1;
  return { w: PRODUCT_MAX.w * share, h: PRODUCT_MAX.h * share };
}

// The product zone below the badge's room.
const ROOM_ZONE: Box = {
  ...PRODUCT_ZONE,
  y: PRODUCT_ZONE.y + BADGE_ROOM,
  h: PRODUCT_ZONE.h - BADGE_ROOM,
};

// The product, trimmed to its outline, scaled to the largest size that fits the product zone and centred in it. With `room` (every new cut-out) the zone starts below the badge's room and the product sits on its bottom.
export function placeProduct(
  width: number,
  height: number,
  size?: BriefSettings["productSize"],
  room?: 1,
): Box {
  const zone = room ? ROOM_ZONE : PRODUCT_ZONE;
  const limit = productLimit(size);
  const scale = Math.min(
    Math.min(limit.w, zone.w) / width,
    Math.min(limit.h, zone.h) / height,
  );
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return {
    x: Math.floor((CANVAS.width - w) / 2),
    y: room ? zone.y + zone.h - h : Math.round(zone.y + (zone.h - h) / 2),
    w,
    h,
  };
}
