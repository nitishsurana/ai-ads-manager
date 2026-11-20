import { MASK_MODEL } from "@/lib/providers/fal";
import { SnapshotError } from "@/lib/providers/snapshot";
import { backdropMask } from "./backdrop";
import { checkPhoto } from "./check";
import { thumbnail, modelCopy } from "./copies";
import { makeCutout } from "./cutout";
import { decideDrop } from "./drop";
import { logSwallowed } from "./log";
import { countMainShapes } from "./mask";
import type { PreparedImage } from "./prepare";
import { isLowResolution, photoWarnings } from "./warnings";
import type {
  CostEntry,
  DropReason,
  Photo,
  PhotoTier,
  PhotosDeps,
} from "./types";

const PHOTOS_BUCKET = "photos";
const CUTOUTS_BUCKET = "cutouts";
export { MASK_MODEL };

// A provider failure skips the photo; a replay or recording problem must still fail loudly.
async function attempt<T>(
  label: string,
  what: string,
  work: () => Promise<T>,
): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof SnapshotError) throw error;
    logSwallowed(label, what, error);
    return null;
  }
}

type Source = {
  position: number;
  sourceUrl: string;
  image: PreparedImage;
};

export async function processPhoto(
  input: { intakeId: string; source: Source },
  deps: Pick<PhotosDeps, "ai" | "fal" | "storage">,
  // Shared with the caller, so spend survives a throw from this photo or another.
  costs: CostEntry[],
): Promise<Photo | null> {
  const { intakeId, source } = input;
  const { position, image } = source;
  const { storage } = deps;
  const stem = `${intakeId}/${position}`;

  const label = `intake ${intakeId} photo ${position}`;
  const forModel = await modelCopy(image.work);

  const checked = await checkPhoto(
    { label, sha256: image.sha256, image: forModel },
    deps,
  );
  costs.push(...checked.costs);
  if (!checked.checks) return null;
  const checks = {
    ...checked.checks,
    backdrop_uniform: (await backdropMask(image.work)).uniform,
  };

  let dropReason: DropReason | null = null;
  let mask: { bytes: Buffer; cutout: Buffer } | null = null;

  const decision = decideDrop(checks);
  if (decision.action === "drop") dropReason = decision.reason;
  if (decision.action === "check_mask") {
    const bytes = await attempt(label, "fal mask", () =>
      deps.fal.backgroundMask({
        inputSha256: image.sha256,
        image: forModel,
        contentType: "image/jpeg",
      }),
    );
    if (!bytes) return null;
    costs.push({ provider: "fal", model: MASK_MODEL, usd: null });
    const analysed = await attempt(label, "mask analysis", async () => ({
      shapes: await countMainShapes(bytes),
      cutout: await makeCutout(image.work, bytes),
    }));
    if (!analysed) return null;
    mask = { bytes, cutout: analysed.cutout };
    // Zero shapes also drops: the spec wants exactly one.
    if (analysed.shapes !== 1) dropReason = "mask_not_one_shape";
  }

  // Storage is written only once every provider call has succeeded, so a skipped photo leaves nothing behind.
  const workExt = image.workType === "image/png" ? "png" : "jpg";
  const workPath = `${stem}-work.${workExt}`;
  const thumbPath = `${stem}-thumb.jpg`;
  const maskPath = mask ? `${stem}-mask.png` : null;
  const cutoutPath = mask ? `${stem}-cutout.png` : null;
  await Promise.all([
    storage.put(PHOTOS_BUCKET, workPath, image.work, image.workType),
    thumbnail(image.work).then((thumb) =>
      storage.put(PHOTOS_BUCKET, thumbPath, thumb, "image/jpeg"),
    ),
    ...(mask && maskPath && cutoutPath
      ? [
          storage.put(CUTOUTS_BUCKET, maskPath, mask.bytes, "image/png"),
          storage.put(CUTOUTS_BUCKET, cutoutPath, mask.cutout, "image/png"),
        ]
      : []),
  ]);

  const lowRes = isLowResolution(image.origWidth, image.origHeight);
  const tier: PhotoTier = checks.added_text
    ? "added_text"
    : lowRes
      ? "clean_low_res"
      : "clean";
  const dropped = dropReason !== null;
  const warnings = dropped
    ? []
    : photoWarnings({
        origWidth: image.origWidth,
        origHeight: image.origHeight,
        addedText: checks.added_text,
        transparent: checks.transparent,
      });

  return {
    position,
    sourceUrl: source.sourceUrl,
    origWidth: image.origWidth,
    origHeight: image.origHeight,
    workPath,
    thumbPath,
    sha256: image.sha256,
    phash: image.hash,
    checks,
    tier,
    dropped,
    dropReason,
    cutoutPath,
    maskPath,
    selected: !dropped,
    warnings,
  };
}
