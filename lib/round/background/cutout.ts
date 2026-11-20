import sharp from "sharp";
import type { BriefSettings } from "@/lib/brief/schema";
import {
  backdropMask,
  chooseMask,
  countMainShapes,
  makeCutout,
  maskStats,
  unionMask,
  type MaskChoice,
} from "@/lib/intake";
import type { Box } from "@/lib/render";
import type { FrozenPhoto } from "../inputs";
import type { StageDeps, StoredPhoto } from "../stages/types";
import { fillSmallHoles } from "./holes";
import { placeProduct } from "./placement";

const MASK_SIDE = 512;
const MASK_INPUT_SIDE = 2048;
const MASK_THRESHOLD = 128;
const HOLE_SHARE = 0.015;
// Bumped when the backdrop mask or the choice rule changes: stored creatives keep the recipe they were made with, so a new rule gets a new number.
const BACKDROP = "backdrop-1";
const MODEL = "model-1";

export type Cutout = { choice: MaskChoice; mask: Buffer; bbox: Box };

export type PreparedPhoto = {
  id: string;
  sha256: string;
  work: Buffer;
  // The product's box as fractions of the work image.
  bbox: Box;
  mask: Buffer;
  // The mask `cutout: 1` candidates cut out with: the model's, or the backdrop's (the whole set) where the choice rule picks it. Chosen on first call and kept on the photo.
  backdrop: () => Promise<Cutout>;
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

// The mask a photo's `cutout: 1` candidates use. The choice is made once per recipe from the work copy and the model mask; the backdrop choice is kept as its own file, so a later candidate, round or edit re-derives the same box.
async function chooseCutout(
  photo: StoredPhoto,
  input: {
    work: Buffer;
    model: Buffer;
    bbox: Box;
    frozen: Pick<FrozenPhoto, "tier" | "giftSet">;
    stem: string;
  },
  deps: Pick<StageDeps, "storage" | "photos">,
): Promise<Cutout> {
  const { model, bbox } = input;
  const asModel: Cutout = { choice: "model", mask: model, bbox };
  if (photo.maskChoice === MODEL) return asModel;
  const stored =
    photo.maskChoice === BACKDROP && photo.backdropPath
      ? await deps.storage.get("cutouts", photo.backdropPath)
      : null;
  if (stored) {
    return { choice: "backdrop", mask: stored, bbox: await maskBbox(stored) };
  }

  const found = await backdropMask(input.work);
  const chosen =
    found.mask &&
    chooseMask({
      ...input.frozen,
      uniform: found.uniform,
      ...(await maskStats(model, found.mask)),
    });
  if (!found.mask || chosen !== "backdrop") {
    await deps.photos.setCutout(photo.id, { maskChoice: MODEL });
    return asModel;
  }
  const mask = await unionMask(model, found.mask);
  const backdropPath = `${input.stem}-${BACKDROP}.png`;
  await deps.storage.put("cutouts", backdropPath, mask, "image/png");
  await deps.photos.setCutout(photo.id, { backdropPath, maskChoice: BACKDROP });
  return { choice: "backdrop", mask, bbox: await maskBbox(mask) };
}

// The photo's work copy, mask and product box. Cut out on first use (BiRefNet) and kept on the photo, so a later candidate or round reuses it. `frozen` is the round's own record of the photo, which decides the backdrop choice.
export async function preparePhoto(
  photoId: string,
  deps: Deps,
  frozen: Pick<FrozenPhoto, "tier" | "giftSet">,
): Promise<PreparedPhoto> {
  const photo = await deps.photos.get(photoId);
  const work = await required(deps.storage, "photos", photo.workPath);
  const stem = stemOf(photo.workPath);

  let mask = photo.maskPath
    ? await deps.storage.get("cutouts", photo.maskPath)
    : null;
  let bbox: Box;
  if (mask) {
    bbox = photo.productBbox ?? (await maskBbox(mask));
    if (!photo.productBbox) {
      await deps.photos.setCutout(photoId, { productBbox: bbox });
    }
  } else {
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
    bbox = await maskBbox(mask);
    await deps.photos.setCutout(photoId, {
      maskPath,
      cutoutPath,
      productBbox: bbox,
    });
  }

  const model = mask;
  let chosen: Promise<Cutout> | undefined;
  return {
    id: photoId,
    sha256: photo.sha256,
    work,
    bbox,
    mask,
    backdrop: () =>
      (chosen ??= chooseCutout(
        photo,
        { work, model, bbox, frozen, stem },
        deps,
      )),
  };
}

// The product alone: trimmed to its box, scaled into the product zone, small gaps in its outline filled.
export async function productCutout(
  photo: PreparedPhoto,
  size?: BriefSettings["productSize"],
  // The recipe version a candidate was planned with; absent means the model mask.
  recipe?: 1,
) {
  const { mask, bbox } = recipe ? await photo.backdrop() : photo;
  const cutout = sharp(await makeCutout(photo.work, mask));
  const { width, height } = await cutout.metadata();
  if (!width || !height) throw new Error("cut-out: the cut-out has no size");
  const left = Math.floor(bbox.x * width);
  const top = Math.floor(bbox.y * height);
  const crop = {
    left,
    top,
    width: Math.min(width - left, Math.ceil(bbox.w * width)),
    height: Math.min(height - top, Math.ceil(bbox.h * height)),
  };
  const box = placeProduct(crop.width, crop.height, size);
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
