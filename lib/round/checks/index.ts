import sharp from "sharp";
import { PNG_MAX_BYTES } from "@/lib/config";
import {
  CANVAS,
  decodePixels,
  layoutSchema,
  missingGlyphs,
  renderCreative,
  underText,
  type Box,
  type FontSet,
} from "@/lib/render";
import {
  cropPhoto,
  photoPlacement,
  productCutout,
  isCutOff,
  scaledPhoto,
  type PhotoPlacement,
  type PreparedPhoto,
} from "../background";
import type { Logo } from "../compose";
import type { StageDeps } from "../stages/types";
import type { Candidate, RoundContext } from "../types";
import { layoutProblems } from "./layout";
import {
  borderProblems,
  contrastProblems,
  drawnBoxes,
  productProblems,
  type Expected,
} from "./pixels";
import { readbackProblems } from "./readback";

export { normalise, readbackProblems } from "./readback";
export { COVERS_PRODUCT, layoutProblems } from "./layout";

export const CUT_OFF = "product: cut off by the canvas edge";

export type CheckContext = {
  input: RoundContext;
  fonts: FontSet;
  logo: Logo | null;
  deps: Pick<StageDeps, "readBack" | "storage">;
  prepared: (photoId: string) => Promise<PreparedPhoto>;
};

const pixelsOf = (image: Buffer, from: Box) =>
  sharp(image)
    .extract({ left: from.x, top: from.y, width: from.w, height: from.h })
    .ensureAlpha()
    .raw()
    .toBuffer();

// The product's pixels and box as the plan puts them. A product in a placed photo is pasted back untouched, so its pixels come from the scaled photo.
async function expectedProduct(
  candidate: Candidate,
  photo: PreparedPhoto,
  placement: PhotoPlacement | null,
): Promise<Expected> {
  const { background } = candidate;
  if (background.method === "photo") {
    if (placement && !placement.cover) {
      const { product, left, top } = placement;
      const scaled = await scaledPhoto(photo.work, placement);
      return {
        rgba: await pixelsOf(scaled, {
          ...product,
          x: product.x - left,
          y: product.y - top,
        }),
        box: product,
      };
    }
    const { bytes, product } = await cropPhoto(photo.work, photo.bbox);
    return { rgba: await pixelsOf(bytes, product), box: product };
  }
  const { png, box } = await productCutout(photo, background.size);
  return { rgba: await sharp(png).ensureAlpha().raw().toBuffer(), box };
}

const sameBox = (a: Expected["box"], b: Expected["box"] | null) =>
  b !== null &&
  Math.abs(a.x - b.x) <= 1 &&
  Math.abs(a.y - b.y) <= 1 &&
  Math.abs(a.w - b.w) <= 1 &&
  Math.abs(a.h - b.h) <= 1;

// Layer 1 for one candidate: every reason it fails, or none. The creative is drawn again from its stored background and layout, the way an export will draw it, so the checks see the file a tester would download. The read-back is a paid call and runs only when everything else passed.
export async function checkCandidate(
  candidate: Candidate,
  ctx: CheckContext,
): Promise<string[]> {
  const { input, fonts, deps } = ctx;
  if (
    !candidate.backgroundPath ||
    !candidate.previewPath ||
    !candidate.layout ||
    !candidate.copy
  ) {
    return ["render: the candidate has no finished render"];
  }
  const parsed = layoutSchema.safeParse(candidate.layout);
  if (!parsed.success) return ["layout: the stored layout is not valid"];
  const layout = parsed.data;
  const background = await deps.storage.get(
    "backgrounds",
    candidate.backgroundPath,
  );
  if (!background) return ["render: the stored background is missing"];

  const { png, problems: drawn } = await renderCreative({
    background,
    layout,
    fonts,
    logo: ctx.logo?.png ?? null,
  });
  const photo = await ctx.prepared(candidate.photoId);
  const placement =
    candidate.background.method === "photo" &&
    candidate.background.placement === 2
      ? await photoPlacement(photo)
      : null;
  const [meta, backgroundMeta, backgroundPixels, basePixels, expected] =
    await Promise.all([
      sharp(png).metadata(),
      sharp(background).metadata(),
      decodePixels(background),
      underText(background, layout).then(decodePixels),
      expectedProduct(candidate, photo, placement),
    ]);

  const problems = [
    ...(meta.width === CANVAS.width &&
    meta.height === CANVAS.height &&
    meta.format === "png"
      ? []
      : [
          `size: the creative is ${meta.width}x${meta.height} ${meta.format}, not 1080x1920 png`,
        ]),
    ...(png.length < PNG_MAX_BYTES ? [] : ["size: the PNG is over 10 MB"]),
    ...(backgroundMeta.width === CANVAS.width &&
    backgroundMeta.height === CANVAS.height
      ? []
      : ["size: the background is not 1080x1920"]),
    ...drawn.map((problem) => `layout: ${problem}`),
    ...layoutProblems(layout, candidate, input.inputs, (family, text) =>
      missingGlyphs(fonts, family, text),
    ),
    ...borderProblems(backgroundPixels),
    ...contrastProblems(basePixels, layout),
    ...(sameBox(expected.box, candidate.product)
      ? []
      : ["product: its box is not where the plan put it"]),
    ...(placement && isCutOff(placement, photo.bbox) ? [CUT_OFF] : []),
    ...(await productProblems(png, expected, drawnBoxes(layout))),
  ];
  if (problems.length > 0) return problems;
  return readbackProblems(layout, await deps.readBack(png, layout));
}
