import sharp from "sharp";
import { countMainShapes, makeCutout } from "@/lib/intake";
import type { Box } from "@/lib/render";
import type { StageDeps } from "../stages/types";
import { fillSmallHoles } from "./holes";
import { placeProduct } from "./placement";

const MASK_SIDE = 512;
const MASK_INPUT_SIDE = 2048;
const MASK_THRESHOLD = 128;
const HOLE_SHARE = 0.015;

export type PreparedPhoto = {
  id: string;
  sha256: string;
  work: Buffer;
  // The product's box as fractions of the work image.
  bbox: Box;
  mask: Buffer;
};

type Deps = Pick<StageDeps, "storage" | "fal" | "photos">;

// Steady files per photo, under the same stem step 1 uses for the photos it masked.
const stemOf = (workPath: string) => workPath.replace(/-work\.[a-z]+$/, "");

// The product's box from a mask, as fractions of the image; one grid cell of margin each side.
export async function maskBbox(mask: Buffer): Promise<Box> {
  const { data, info } = await sharp(mask)
    .flatten({ background: "#000000" })
    .greyscale()
    .resize(MASK_SIDE, MASK_SIDE, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[y * width + x] ?? 0) < MASK_THRESHOLD) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error("cut-out: the mask has no product in it");
  const x0 = Math.max(0, left - 1);
  const y0 = Math.max(0, top - 1);
  const x1 = Math.min(width, right + 2);
  const y1 = Math.min(height, bottom + 2);
  return {
    x: x0 / width,
    y: y0 / height,
    w: (x1 - x0) / width,
    h: (y1 - y0) / height,
  };
}

async function required(
  storage: StageDeps["storage"],
  bucket: string,
  path: string,
) {
  const bytes = await storage.get(bucket, path);
  if (!bytes) throw new Error(`storage: ${bucket}/${path} is missing`);
  return bytes;
}

// The photo's work copy, mask and product box. Cut out on first use (BiRefNet) and kept on the photo, so a later candidate or round reuses it.
export async function preparePhoto(
  photoId: string,
  deps: Deps,
): Promise<PreparedPhoto> {
  const photo = await deps.photos.get(photoId);
  const work = await required(deps.storage, "photos", photo.workPath);
  const stem = stemOf(photo.workPath);

  let mask = photo.maskPath
    ? await deps.storage.get("cutouts", photo.maskPath)
    : null;
  if (!mask) {
    const image = await sharp(work)
      .flatten({ background: "#ffffff" })
      .resize(MASK_INPUT_SIDE, MASK_INPUT_SIDE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90 })
      .toBuffer();
    mask = await deps.fal.backgroundMask({
      inputSha256: photo.sha256,
      image,
      contentType: "image/jpeg",
    });
    if ((await countMainShapes(mask)) === 0) {
      throw new Error(`cut-out: photo ${photoId} has no product shape`);
    }
    const maskPath = `${stem}-mask.png`;
    const cutoutPath = `${stem}-cutout.png`;
    await Promise.all([
      deps.storage.put("cutouts", maskPath, mask, "image/png"),
      makeCutout(work, mask).then((cutout) =>
        deps.storage.put("cutouts", cutoutPath, cutout, "image/png"),
      ),
    ]);
    const productBbox = await maskBbox(mask);
    await deps.photos.setCutout(photoId, { maskPath, cutoutPath, productBbox });
    return { id: photoId, sha256: photo.sha256, work, bbox: productBbox, mask };
  }

  const bbox = photo.productBbox ?? (await maskBbox(mask));
  if (!photo.productBbox) {
    await deps.photos.setCutout(photoId, { productBbox: bbox });
  }
  return { id: photoId, sha256: photo.sha256, work, bbox, mask };
}

// The product alone: trimmed to its box, scaled into the product zone, small gaps in its outline filled.
export async function productCutout(photo: PreparedPhoto) {
  const cutout = sharp(await makeCutout(photo.work, photo.mask));
  const { width, height } = await cutout.metadata();
  if (!width || !height) throw new Error("cut-out: the cut-out has no size");
  const left = Math.floor(photo.bbox.x * width);
  const top = Math.floor(photo.bbox.y * height);
  const crop = {
    left,
    top,
    width: Math.min(width - left, Math.ceil(photo.bbox.w * width)),
    height: Math.min(height - top, Math.ceil(photo.bbox.h * height)),
  };
  const box = placeProduct(crop.width, crop.height);
  const resized = await cutout
    .extract(crop)
    .resize(box.w, box.h, { kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const pixels = box.w * box.h;
  const alpha = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i++) alpha[i] = resized[i * 4 + 3] ?? 0;
  const filled = fillSmallHoles(alpha, box.w, box.h, HOLE_SHARE);
  for (let i = 0; i < pixels; i++) resized[i * 4 + 3] = filled[i] ?? 0;
  const png = await sharp(resized, {
    raw: { width: box.w, height: box.h, channels: 4 },
  })
    .png()
    .toBuffer();
  return { png, box };
}
