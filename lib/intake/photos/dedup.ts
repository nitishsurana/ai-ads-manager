const CHANNELS = 3;

// Untuned: the real rows so far only merged byte-identical copies, so these were set on synthetic resizes and tested only against the committed fixtures.
const NEAR_DUPLICATE = {
  // Aspect ratios of resized copies differ by rounding only.
  aspectTolerance: 0.01,
  // Mean absolute RGB difference (0-255) over the whole 16x16 image.
  maxMeanDiff: 1.5,
  // Largest per-cell mean difference: a colour variant changes some cells a lot even when most of the frame is white.
  maxCellDiff: 16,
} as const;

export type Hashed = {
  position: number;
  sha256: string;
  hash: string;
  origWidth: number;
  origHeight: number;
};

function similar(a: Hashed, b: Hashed) {
  if (a.sha256 === b.sha256) return true;
  // Only the same picture at a different size counts; a same-size copy with other bytes is its own photo.
  if (a.origWidth === b.origWidth && a.origHeight === b.origHeight) {
    return false;
  }
  const ratioA = a.origWidth / a.origHeight;
  const ratioB = b.origWidth / b.origHeight;
  if (Math.abs(ratioA - ratioB) / ratioA > NEAR_DUPLICATE.aspectTolerance)
    return false;

  const left = Buffer.from(a.hash, "hex");
  const right = Buffer.from(b.hash, "hex");
  if (left.length !== right.length) return false;

  let total = 0;
  let worstCell = 0;
  for (let i = 0; i < left.length; i += CHANNELS) {
    let cell = 0;
    for (let c = 0; c < CHANNELS; c++) {
      cell += Math.abs((left[i + c] ?? 0) - (right[i + c] ?? 0));
    }
    total += cell;
    worstCell = Math.max(worstCell, cell / CHANNELS);
  }
  return (
    total / left.length <= NEAR_DUPLICATE.maxMeanDiff &&
    worstCell <= NEAR_DUPLICATE.maxCellDiff
  );
}

// Items are visited by position, so each duplicate points at the lowest-position copy.
export function findDuplicates<T extends Hashed>(items: readonly T[]) {
  const kept: T[] = [];
  const duplicates: { position: number; duplicateOf: number }[] = [];
  for (const item of [...items].sort((a, b) => a.position - b.position)) {
    const match = kept.find((other) => similar(item, other));
    if (match)
      duplicates.push({ position: item.position, duplicateOf: match.position });
    else kept.push(item);
  }
  return { unique: kept, duplicates };
}
