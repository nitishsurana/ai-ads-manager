import sharp from "sharp";
import { sha256 } from "@/lib/providers/snapshot";
import { CANVAS, type Box } from "@/lib/render";
import { estimateGrade, SILHOUETTE_ALPHA } from "./finish";
import type { LightDirection } from "./light";
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
const SHADOWS: Record<LightDirection, string> = {
  left: "from the left: shadows fall to the right",
  "upper left": "from the upper left: shadows fall to the lower right",
  above: "from above: shadows fall directly beneath it",
  "upper right": "from the upper right: shadows fall to the lower left",
  right: "from the right: shadows fall to the left",
};

// `person` is a cut-out that carries a person: the scene may not add another. `light` is where the product's own light comes from, when it has one.
export function briaInstruction(
  scenePrompt: string,
  { person, light }: { person: boolean; light: LightDirection | null },
) {
  const scene = scenePrompt
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");
  const lighting = light
    ? `The product is lit ${SHADOWS[light]}, and its soft contact shadow matches. No visible light source.`
    : "Light the scene to match the product and add a soft, natural contact shadow under it.";
  return `Replace the plain grey background with: ${scene}. Keep the product exactly as it is, in the same place and at the same size. ${lighting} Photorealistic product photography, vertical 9:16. ${NO_TEXT} ${person ? "No other people." : "No people."} ${NO_DUPLICATE} ${CALM_TOP}`;
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
    .threshold(SILHOUETTE_ALPHA)
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

const framed = (edited: Buffer) =>
  sharp(edited).resize(EDIT_WIDTH, CANVAS.height, { fit: "cover" }).extract({
    left: EDIT_MARGIN,
    top: 0,
    width: CANVAS.width,
    height: CANVAS.height,
  });

// The colour gains for the product, read from the edited scene as the ad frames it.
export async function sceneGrade(
  edited: Buffer,
  product: { rgba: Buffer; box: Box },
) {
  const { data, info } = await framed(edited)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return estimateGrade(
    { data, width: info.width, height: info.height },
    product,
  );
}

// The edited canvas cropped to the ad's width, with the finished product pasted back.
export async function pasteProduct(edited: Buffer, product: Buffer, box: Box) {
  return framed(edited)
    .composite([{ input: product, left: box.x, top: box.y }])
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
