import sharp from "sharp";
import { sha256 } from "@/lib/providers/snapshot";
import { CANVAS } from "@/lib/render";
import type { StageDeps } from "../stages/types";
import { CALM_TOP, GREY, NO_DUPLICATE, NO_TEXT } from "./bria";
import {
  cropPhoto,
  interior,
  placeWholePhoto,
  type PhotoPlacement,
} from "./photo-crop";
import { EDIT_MARGIN, EDIT_WIDTH } from "./placement";
import type { PreparedPhoto } from "./cutout";

// Bumped when the canvas, mask or paste-back recipe changes, so recorded edits stop matching.
const EXTEND_RECIPE = "extend-1";

const EXTEND =
  "Extend the photo's scene seamlessly into the plain grey areas, continuing its surfaces, backdrop, lighting and colours. Keep everything already in the photo exactly as it is.";

export function extendInstruction(person: boolean) {
  return [
    EXTEND,
    NO_TEXT,
    ...(person ? [] : ["No people."]),
    NO_DUPLICATE,
    CALM_TOP,
  ].join(" ");
}

export function extendKey(input: {
  photoSha256: string;
  placement: Pick<PhotoPlacement, "width" | "height" | "left" | "top">;
  instruction: string;
  seed: number;
}) {
  const { width, height, left, top } = input.placement;
  return sha256(
    Buffer.from(
      [
        EXTEND_RECIPE,
        input.photoSha256,
        `${width}x${height}@${left},${top}`,
        input.seed,
        input.instruction,
      ].join("\n"),
    ),
  );
}

export async function photoPlacement(
  photo: Pick<PreparedPhoto, "work" | "bbox">,
  whole = false,
) {
  const { width, height } = await sharp(photo.work).metadata();
  if (!width || !height) throw new Error("photo: the photo has no size");
  return placeWholePhoto({ width, height }, photo.bbox, { whole });
}

export const scaledPhoto = (
  work: Buffer,
  { width, height }: Pick<PhotoPlacement, "width" | "height">,
) =>
  sharp(work)
    .flatten({ background: "#ffffff" })
    .resize(width, height, { kernel: "lanczos3" })
    .png()
    .toBuffer();

const solid = (width: number, height: number, colour: string) =>
  sharp({ create: { width, height, channels: 3, background: colour } })
    .png()
    .toBuffer();

// Canvas and mask: the photo on flat grey, and a mask that repaints the grey and the blend strips.
async function extendInputs(scaled: Buffer, placement: PhotoPlacement) {
  const at = { left: EDIT_MARGIN + placement.left, top: placement.top };
  const edit = interior(placement);
  const canvas = await sharp({
    create: {
      width: EDIT_WIDTH,
      height: CANVAS.height,
      channels: 3,
      background: GREY,
    },
  })
    .composite([{ input: scaled, ...at }])
    .png()
    .toBuffer();
  const mask = await sharp({
    create: {
      width: EDIT_WIDTH,
      height: CANVAS.height,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([
      {
        input: await solid(edit.width, edit.height, "#000000"),
        left: EDIT_MARGIN + edit.left,
        top: edit.top,
      },
    ])
    .png()
    .toBuffer();
  return { canvas, mask };
}

// The 1080x1920 background for a whole photo placed with `placement`: the photo itself under cover, otherwise the photo with its bands painted by a masked edit. The photo is pasted back untouched except for the blend strips.
export async function wholePhotoBackground(
  photo: PreparedPhoto,
  placement: PhotoPlacement,
  deps: Pick<StageDeps, "fal">,
  options: { seed: number; person: boolean },
) {
  if (placement.cover) return cropPhoto(photo.work, photo.bbox);

  const scaled = await scaledPhoto(photo.work, placement);
  const instruction = extendInstruction(options.person);
  const { canvas, mask } = await extendInputs(scaled, placement);
  const edited = await deps.fal.backgroundEdit({
    inputSha256: extendKey({
      photoSha256: photo.sha256,
      placement,
      instruction,
      seed: options.seed,
    }),
    instruction,
    canvas,
    mask,
    seed: options.seed,
  });
  const keep = interior(placement);
  const kept = await sharp(scaled)
    .extract({
      left: keep.left - placement.left,
      top: keep.top - placement.top,
      width: keep.width,
      height: keep.height,
    })
    .png()
    .toBuffer();
  const bytes = await sharp(edited)
    .resize(EDIT_WIDTH, CANVAS.height, { fit: "cover" })
    .extract({
      left: EDIT_MARGIN,
      top: 0,
      width: CANVAS.width,
      height: CANVAS.height,
    })
    .composite([{ input: kept, left: keep.left, top: keep.top }])
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
  return { bytes, product: placement.product };
}
