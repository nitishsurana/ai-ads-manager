import sharp from "sharp";
import { sha256 } from "@/lib/providers/snapshot";
import { CANVAS, type Box } from "@/lib/render";
import { EDIT_MARGIN, EDIT_WIDTH } from "./placement";

export const GREY = { r: 154, g: 154, b: 154 };
// Bumped when the canvas or mask recipe changes, so recorded edits stop matching.
export const EDIT_RECIPE = "canvas-2";

// Added in code after the model's scene prompt, which is free text and may carry words from scraped research notes. The wording follows the Nov 15 evaluation, which saw no stray text with it.
export const NO_TEXT =
  "No text, letters, numbers, logos, signage or watermarks anywhere.";
export const NO_DUPLICATE = "Do not duplicate the product.";
export const CALM_TOP =
  "Keep the top third calm and uncluttered: soft, even tones, no objects.";
const SUFFIX = `Keep the product exactly as it is, in the same place and at the same size. Light the scene to match the product and add a soft, natural contact shadow under it. Photorealistic product photography, vertical 9:16. ${NO_TEXT} No people. ${NO_DUPLICATE} ${CALM_TOP}`;

export function briaInstruction(scenePrompt: string) {
  const scene = scenePrompt
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");
  return `Replace the plain grey background with: ${scene}. ${SUFFIX}`;
}

// Keyed by what goes into the canvas, not by the PNG bytes, so an encoder update doesn't orphan the recordings.
export function editKey(input: {
  photoSha256: string;
  box: Box;
  instruction: string;
  seed: number;
}) {
  const { box } = input;
  return sha256(
    Buffer.from(
      [
        EDIT_RECIPE,
        input.photoSha256,
        `${box.w}x${box.h}@${box.x},${box.y}`,
        input.seed,
        input.instruction,
      ].join("\n"),
    ),
  );
}

// The product on flat grey, and the mask that repaints everything but it. The mask keeps the product's outline shrunk by about 2 px, so no grey fringe survives.
export async function editInputs(product: Buffer, box: Box) {
  const left = box.x + EDIT_MARGIN;
  const canvas = await sharp({
    create: {
      width: EDIT_WIDTH,
      height: CANVAS.height,
      channels: 3,
      background: GREY,
    },
  })
    .composite([{ input: product, left, top: box.y }])
    .png()
    .toBuffer();

  const alpha = await sharp(product)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer();
  const silhouette = await sharp(alpha, {
    raw: { width: box.w, height: box.h, channels: 1 },
  })
    .threshold(11)
    .png()
    .toBuffer();
  const placed = await sharp({
    create: {
      width: EDIT_WIDTH,
      height: CANVAS.height,
      channels: 3,
      background: "#000000",
    },
  })
    .composite([{ input: silhouette, left, top: box.y }])
    .png()
    .toBuffer();
  const mask = await sharp(placed)
    .greyscale()
    .blur(1)
    .threshold(250)
    .negate()
    .png()
    .toBuffer();
  return { canvas, mask };
}

// The edited canvas cropped to the ad's width, with the product pasted back untouched.
export async function pasteProduct(edited: Buffer, product: Buffer, box: Box) {
  return sharp(edited)
    .resize(EDIT_WIDTH, CANVAS.height, { fit: "cover" })
    .extract({
      left: EDIT_MARGIN,
      top: 0,
      width: CANVAS.width,
      height: CANVAS.height,
    })
    .composite([{ input: product, left: box.x, top: box.y }])
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
