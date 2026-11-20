import type { Box } from "@/lib/render";
import type { RoundInputs } from "../inputs";
import type { StageDeps } from "../stages/types";
import type { Candidate } from "../types";
import { briaInstruction, editInputs, editKey, pasteProduct } from "./bria";
import { briaSeed } from "./seed";
import { productCutout, type PreparedPhoto } from "./cutout";
import { fillBackground, fillColour } from "./fills";
import { cropPhoto } from "./photo-crop";
import { photoPlacement, wholePhotoBackground } from "./whole-photo";

export { preparePhoto, productCutout, type PreparedPhoto } from "./cutout";
export { cropPhoto, isCutOff, type PhotoPlacement } from "./photo-crop";
export { photoPlacement, scaledPhoto } from "./whole-photo";

type Deps = Pick<StageDeps, "fal">;

// The 1080x1920 JPEG with the scene and the product only (no text, badge, logo or scrim), and where the product sits in it.
export async function makeBackground(
  candidate: Candidate,
  photo: PreparedPhoto,
  inputs: RoundInputs,
  deps: Deps,
  // The round's attempt, and how often this candidate was redone: both change the seed.
  variation: { attempt: number; regeneration?: number },
): Promise<{
  bytes: Buffer;
  product: Box;
  isolated?: boolean;
  gaps?: boolean;
}> {
  const { background } = candidate;
  if (background.method === "photo") {
    if (background.placement !== 2) return cropPhoto(photo.work, photo.bbox);
    const placement = await photoPlacement(photo, background.whole);
    const { bytes, product } = await wholePhotoBackground(
      photo,
      placement,
      deps,
      {
        seed: briaSeed(
          candidate.index,
          variation.attempt,
          variation.regeneration,
        ),
        person:
          inputs.photos.find((p) => p.id === candidate.photoId)?.person ??
          false,
      },
    );
    return {
      bytes,
      product,
      isolated: placement.isolated,
      gaps: !placement.cover,
    };
  }

  const { png, box } = await productCutout(
    photo,
    background.size,
    background.cutout,
  );
  if (background.method === "bria") {
    const instruction = briaInstruction(background.prompt);
    const seed = briaSeed(
      candidate.index,
      variation.attempt,
      variation.regeneration,
    );
    const { canvas, mask } = await editInputs(png, box);
    const edited = await deps.fal.backgroundEdit({
      inputSha256: editKey({
        photoSha256: photo.sha256,
        box,
        instruction,
        seed,
      }),
      instruction,
      canvas,
      mask,
      seed,
    });
    return { bytes: await pasteProduct(edited, png, box), product: box };
  }

  const bytes = await fillBackground(
    background.method,
    fillColour(inputs.brandKit.palette),
    { png, box },
  );
  return { bytes, product: box };
}
