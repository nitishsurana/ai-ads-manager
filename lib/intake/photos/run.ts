import { sha256 } from "@/lib/providers/snapshot";
import { findDuplicates } from "./dedup";
import { fetchOriginal } from "./fetch";
import { logSwallowed } from "./log";
import { mapLimit } from "./pool";
import { processPhoto } from "./process";
import { prepareImage, UnreadableImageError } from "./prepare";
import { PhotosStageError } from "./types";
import type { CostEntry, PhotosDeps, PhotosInput, PhotosResult } from "./types";

const CONCURRENCY = 10;
// An outage, not bad photos: at least this many failed checks, and more failures than successes among those completed.
const OUTAGE_FAILURES = 3;

type Duplicate = PhotosResult["duplicates"][number];

// A duplicate may point at a copy that a lower position later displaced.
function resolveDuplicates(duplicates: Duplicate[]) {
  const of = new Map(duplicates.map((d) => [d.position, d.duplicateOf]));
  const root = (position: number): number => {
    const next = of.get(position);
    return next === undefined ? position : root(next);
  };
  return duplicates
    .map((d) => ({ position: d.position, duplicateOf: root(d.position) }))
    .sort((a, b) => a.position - b.position);
}

export async function runPhotos(
  input: PhotosInput,
  deps: PhotosDeps,
): Promise<PhotosResult> {
  const costs: CostEntry[] = [];
  try {
    return await readAndCheck(input, deps, costs);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PhotosStageError(`photos stage failed: ${reason}`, costs, {
      cause: error,
    });
  }
}

async function readAndCheck(
  input: PhotosInput,
  deps: PhotosDeps,
  costs: CostEntry[],
): Promise<PhotosResult> {
  const skipped: PhotosResult["skipped"] = [];
  const exactDuplicates: Duplicate[] = [];
  const claimed = new Map<string, number>();
  const labelOf = (position: number) =>
    `intake ${input.intakeId} photo ${position}`;
  let read = 0;
  const reading = () =>
    deps.progress({
      stage: "photos",
      phase: "reading",
      done: ++read,
      total: input.images.length,
      photo: null,
    });

  const fetched = await mapLimit(
    input.images,
    CONCURRENCY,
    async (image, i) => {
      const position = i + 1;
      const sourceUrl = image.src;
      const original = await fetchOriginal(sourceUrl, deps);
      if (!original.ok) {
        logSwallowed(labelOf(position), "fetch", original.cause);
        skipped.push({ position, reason: original.reason });
        await reading();
        return null;
      }

      // Hashing the original bytes first lets a copy of an already-seen photo skip decoding.
      const hash = sha256(original.bytes);
      const lowest = claimed.get(hash);
      if (lowest !== undefined && lowest < position) {
        exactDuplicates.push({ position, duplicateOf: lowest });
        await reading();
        return null;
      }
      claimed.set(hash, position);

      let prepared;
      try {
        prepared = await prepareImage(original.bytes, hash);
      } catch (error) {
        if (!(error instanceof UnreadableImageError)) throw error;
        logSwallowed(labelOf(position), "decode", error.cause);
        skipped.push({ position, reason: "unreadable" });
        await reading();
        return null;
      }
      await reading();
      return { position, sourceUrl, image: prepared };
    },
  );

  // A copy of a photo that turned out unreadable is unreadable too, not a duplicate.
  const unreadable = new Set(
    skipped.filter((s) => s.reason === "unreadable").map((s) => s.position),
  );
  const copies = exactDuplicates.filter((d) => {
    if (!unreadable.has(d.duplicateOf)) return true;
    skipped.push({ position: d.position, reason: "unreadable" });
    return false;
  });

  const { unique, duplicates } = findDuplicates(
    fetched
      .filter((photo) => photo !== null)
      .map((photo) => ({
        ...photo,
        sha256: photo.image.sha256,
        hash: photo.image.hash,
        origWidth: photo.image.origWidth,
        origHeight: photo.image.origHeight,
      })),
  );

  let done = 0;
  let succeeded = 0;
  let failed = 0;
  const processed = await mapLimit(unique, CONCURRENCY, async (source) => {
    const photo = await processPhoto(
      { intakeId: input.intakeId, source },
      deps,
      costs,
    );
    if (photo) succeeded++;
    else {
      skipped.push({ position: source.position, reason: "check_failed" });
      if (++failed >= OUTAGE_FAILURES && failed > succeeded) {
        throw new Error("photo checks are failing");
      }
    }
    await deps.progress({
      stage: "photos",
      phase: "checking",
      done: ++done,
      total: unique.length,
      photo:
        photo && !photo.dropped
          ? { position: photo.position, thumbPath: photo.thumbPath }
          : null,
    });
    return photo;
  });
  // Checked again once every photo is done, so the outcome doesn't depend on completion order.
  if (failed >= OUTAGE_FAILURES && failed > succeeded) {
    throw new Error("photo checks are failing");
  }

  return {
    photos: processed.flatMap((photo) => (photo ? [photo] : [])),
    duplicates: resolveDuplicates([...copies, ...duplicates]),
    skipped: skipped.sort((a, b) => a.position - b.position),
    costs,
  };
}
