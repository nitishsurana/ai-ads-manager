import sharp from "sharp";
import { CANVAS, type Box } from "@/lib/render";

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
