import { currentVersions, loadFonts, type FontSet } from "@/lib/render";
import {
  makeBackground,
  preparePhoto,
  type PreparedPhoto,
} from "../background";
import { composeCandidate, readLogo, type Logo } from "../compose";
import type { Candidate, RoundContext } from "../types";
import type { StageDeps } from "./types";

async function required(
  storage: StageDeps["storage"],
  bucket: string,
  path: string,
) {
  const bytes = await storage.get(bucket, path);
  if (!bytes) throw new Error(`storage: ${bucket}/${path} is missing`);
  return bytes;
}

// Every new cut-out keeps room above the product for a badge, so a candidate that takes one later (covering) still has a spot and products match across the round; the marker is stored so a later check or edit finds the product where it was put.
const withRoom = (candidate: Candidate): Candidate =>
  candidate.background.method !== "photo"
    ? { ...candidate, background: { ...candidate.background, room: 1 } }
    : candidate;

// The two steps that make one candidate's creative, shared by the stages that run them for the whole round and by the checks, which redo a failing candidate. Photos, fonts and the logo are read once, on first use.
export function createBuilder(
  input: RoundContext,
  deps: Pick<StageDeps, "fal" | "http" | "storage" | "photos">,
) {
  const { inputs } = input;
  const photos = new Map<string, Promise<PreparedPhoto>>();
  const prepared = (photoId: string) => {
    const known = photos.get(photoId);
    if (known) return known;
    const frozen = inputs.photos.find((photo) => photo.id === photoId);
    if (!frozen) {
      throw new Error(
        `round ${input.roundId}: photo ${photoId} is not in its inputs`,
      );
    }
    const started = preparePhoto(photoId, deps, frozen);
    photos.set(photoId, started);
    return started;
  };

  let loaded: Promise<{ fonts: FontSet; logo: Logo | null }> | undefined;
  const assets = () =>
    (loaded ??= (async () => {
      const fonts = await loadFonts(
        currentVersions([
          inputs.brandKit.fonts.heading.family,
          inputs.brandKit.fonts.body.family,
        ]),
        deps,
      );
      const logo = inputs.logo?.pngPath
        ? await readLogo(
            await required(deps.storage, "logos", inputs.logo.pngPath),
            inputs.logo,
          )
        : null;
      return { fonts, logo };
    })());

  return {
    prepared,
    assets,

    // The scene and product, stored without text. `regeneration` changes the Bria seed, so a redo is a different scene.
    async background(
      candidate: Candidate,
      regeneration = 0,
    ): Promise<Candidate> {
      const marked = withRoom(candidate);
      const { bytes, product, isolated, gaps, grade } = await makeBackground(
        marked,
        await prepared(candidate.photoId),
        inputs,
        deps,
        { attempt: input.attempt, regeneration },
      );
      const path = `${input.roundId}/c${candidate.index}.jpg`;
      await deps.storage.put("backgrounds", path, bytes, "image/jpeg");
      const { background } = marked;
      return {
        ...marked,
        background:
          background.method === "photo" && gaps !== undefined
            ? { ...background, isolated, gaps }
            : background.method === "bria" && grade
              ? { ...background, grade }
              : background,
        backgroundPath: path,
        product,
      };
    },

    // The text layer over the stored background, planned from its pixels; stores the preview.
    async compose(candidate: Candidate): Promise<Candidate> {
      if (!candidate.backgroundPath) {
        throw new Error(`candidate ${candidate.index} has no background`);
      }
      const { fonts, logo } = await assets();
      const { layout, preview } = await composeCandidate(
        candidate,
        await required(deps.storage, "backgrounds", candidate.backgroundPath),
        {
          inputs,
          fonts,
          logo,
          label: `round ${input.roundId} candidate ${candidate.index}`,
        },
      );
      const path = `${input.roundId}/c${candidate.index}.jpg`;
      await deps.storage.put("previews", path, preview, "image/jpeg");
      return { ...candidate, layout, previewPath: path };
    },
  };
}

export type Builder = ReturnType<typeof createBuilder>;
