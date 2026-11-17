import sharp from "sharp";
import {
  CANVAS,
  PHOTO_PRODUCT_ZONE,
  PRODUCT_ZONE,
  type Box,
} from "@/lib/render";

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), Math.max(low, high));

// Where the 1080x1920 window sits on the photo scaled to cover it: centred on the product, moved only as far as keeps the whole product inside when it can.
export function coverWindow(
  image: { width: number; height: number },
  bbox: Box,
) {
  const scale = Math.max(
    CANVAS.width / image.width,
    CANVAS.height / image.height,
  );
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const place = (start: number, size: number, window: number, span: number) => {
    const low = Math.max(0, (start + size) * span - window);
    const high = Math.min(span - window, start * span);
    const centred = (start + size / 2) * span - window / 2;
    return Math.round(clamp(centred, low, high));
  };
  const left = place(bbox.x, bbox.w, CANVAS.width, width);
  const top = place(bbox.y, bbox.h, CANVAS.height, height);
  const product: Box = {
    x: Math.max(0, Math.round(bbox.x * width) - left),
    y: Math.max(0, Math.round(bbox.y * height) - top),
    w: Math.round(bbox.w * width),
    h: Math.round(bbox.h * height),
  };
  product.w = Math.min(product.w, CANVAS.width - product.x);
  product.h = Math.min(product.h, CANVAS.height - product.y);
  return { width, height, left, top, product };
}

export async function cropPhoto(work: Buffer, bbox: Box) {
  const { width, height } = await sharp(work).metadata();
  if (!width || !height) throw new Error("photo crop: the photo has no size");
  const window = coverWindow({ width, height }, bbox);
  const bytes = await sharp(work)
    .flatten({ background: "#ffffff" })
    .resize(window.width, window.height, { kernel: "lanczos3" })
    .extract({
      left: window.left,
      top: window.top,
      width: CANVAS.width,
      height: CANVAS.height,
    })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
  return { bytes, product: window.product };
}

// The photo at full width is "tall enough" when its bands would total under this; the product is then kept by cover.
const COVER_SLACK = 24;
// The width of the blend strip: a product this close to a photo side counts as touching it.
export const TOUCH_PX = 8;

export type PhotoPlacement = {
  scale: number;
  // Where the scaled photo sits on the canvas; negative under cover, where the canvas shows a window of it.
  left: number;
  top: number;
  width: number;
  height: number;
  product: Box;
  gaps: { top: number; bottom: number; left: number; right: number };
  cover: boolean;
  isolated: boolean;
};

type Sides = {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
};

// Which sides of the photo, scaled to width x height, the product's bbox is within the blend strip of.
function touchedSides(bbox: Box, width: number, height: number): Sides {
  const near = (gap: number) => gap <= TOUCH_PX;
  return {
    top: near(bbox.y * height),
    bottom: near((1 - bbox.y - bbox.h) * height),
    left: near(bbox.x * width),
    right: near((1 - bbox.x - bbox.w) * width),
  };
}

function measure(
  image: { width: number; height: number },
  scale: number,
  bbox: Box,
) {
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  return {
    width,
    height,
    sides: touchedSides(bbox, width, height),
    productHeight: bbox.h * height,
  };
}

// A whole photo fits the canvas width instead of filling the canvas: bands appear above or below it, and the product is never cropped. A tall enough photo, or one whose product spans it top to bottom, still takes cover. An isolated product (touching no side) sits in the photo zone, shrinking the photo when it is taller than the zone.
export function placeWholePhoto(
  image: { width: number; height: number },
  bbox: Box,
): PhotoPlacement {
  const zone = PHOTO_PRODUCT_ZONE;
  const scale = CANVAS.width / image.width;
  let fit = measure(image, scale, bbox);
  const isolatedAt = (sides: Sides) => !Object.values(sides).includes(true);

  if (
    fit.height >= CANVAS.height - COVER_SLACK ||
    (fit.sides.top && fit.sides.bottom)
  ) {
    const window = coverWindow(image, bbox);
    return {
      scale: window.width / image.width,
      left: -window.left,
      top: -window.top,
      width: window.width,
      height: window.height,
      product: window.product,
      gaps: { top: 0, bottom: 0, left: 0, right: 0 },
      cover: true,
      isolated: false,
    };
  }
  // Isolation is judged at the size the photo would be drawn: a product that only reaches a side once shrunk stays at fit width instead.
  const shrunk = measure(
    image,
    scale * Math.min(1, zone.h / fit.productHeight),
    bbox,
  );
  const isolated = isolatedAt(shrunk.sides);
  if (isolated) fit = shrunk;
  const { width, height, sides } = fit;

  const left = Math.round((CANVAS.width - width) / 2);
  const productTop = bbox.y * height;
  const centre = PRODUCT_ZONE.y + PRODUCT_ZONE.h / 2;
  const centred = centre - fit.productHeight / 2;
  const inZone = clamp(centred, zone.y, zone.y + zone.h - fit.productHeight);
  const wanted = sides.bottom
    ? CANVAS.height - height
    : sides.top
      ? 0
      : (isolated ? inZone : centred) - productTop;
  const top = Math.round(clamp(wanted, 0, CANVAS.height - height));
  const offset = { x: Math.round(bbox.x * width), y: Math.round(productTop) };
  const product: Box = {
    x: left + offset.x,
    y: top + offset.y,
    w: Math.min(Math.round(bbox.w * width), width - offset.x),
    h: Math.min(Math.round(fit.productHeight), height - offset.y),
  };
  return {
    scale: width / image.width,
    left,
    top,
    width,
    height,
    product,
    gaps: {
      top,
      bottom: CANVAS.height - top - height,
      left,
      right: CANVAS.width - left - width,
    },
    cover: false,
    isolated,
  };
}

// A placed photo's product touches a canvas edge only where the product touched the photo's side; cover on a product spanning the photo top to bottom is today's behaviour.
export function isCutOff(
  { product, width, height }: PhotoPlacement,
  bbox: Box,
) {
  const sides = touchedSides(bbox, width, height);
  if (sides.top && sides.bottom) return false;
  return (
    (product.x <= 0 && !sides.left) ||
    (product.x + product.w >= CANVAS.width && !sides.right) ||
    (product.y <= 0 && !sides.top) ||
    (product.y + product.h >= CANVAS.height && !sides.bottom)
  );
}
