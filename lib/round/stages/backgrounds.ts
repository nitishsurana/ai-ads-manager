import {
  makeBackground,
  preparePhoto,
  type PreparedPhoto,
} from "../background";
import { mapLimit } from "@/lib/intake";
import type { Candidate, RoundContext } from "../types";
import type { StageDeps } from "./types";

// Bria takes about 10 s a call; three at a time keeps six candidates well inside the deadline.
const CONCURRENCY = 3;

export async function makeBackgrounds(
  input: RoundContext,
  candidates: Candidate[],
  deps: StageDeps,
): Promise<Candidate[]> {
  const photos = new Map<string, Promise<PreparedPhoto>>();
  const prepared = (photoId: string) => {
    const known = photos.get(photoId);
    if (known) return known;
    const started = preparePhoto(photoId, deps);
    photos.set(photoId, started);
    return started;
  };

  let done = 0;
  return mapLimit(candidates, CONCURRENCY, async (candidate) => {
    const { bytes, product } = await makeBackground(
      candidate,
      await prepared(candidate.photoId),
      input.inputs,
      deps,
      { attempt: input.attempt },
    );
    const path = `${input.roundId}/c${candidate.index}.jpg`;
    await deps.storage.put("backgrounds", path, bytes, "image/jpeg");
    await deps.progress({
      kind: "stage",
      stage: "making_backgrounds",
      done: ++done,
      total: candidates.length,
    });
    return { ...candidate, backgroundPath: path, product };
  });
}
