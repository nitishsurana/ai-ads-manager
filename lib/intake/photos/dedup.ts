const CHANNELS = 3;

type Limits = {
  // Mean absolute RGB difference (0-255) over the whole 16x16 image.
  maxMeanDiff: number;
  // Largest per-cell mean difference: a colour variant changes some cells a lot even when most of the frame is white.
  maxCellDiff: number;
};

// Resized copies differ by rounding and re-encoding. Aspect ratios differ by rounding only.
const RESIZED: Limits = { maxMeanDiff: 1.5, maxCellDiff: 16 };
const ASPECT_TOLERANCE = 0.01;
// Same pixel size: only a visually identical picture with other bytes (a re-export) merges. Real pairs sit at mean 0.00-0.16 and worst cell 0-1.3; same-size colourways and other shots on white start at mean 0.7 or worst cell 5.
const SAME_SIZE: Limits = { maxMeanDiff: 0.3, maxCellDiff: 2 };

export type Hashed = {
  position: number;
  sha256: string;
  hash: string;
  origWidth: number;
  origHeight: number;
};

function similar(a: Hashed, b: Hashed) {
  if (a.sha256 === b.sha256) return true;
  const sameSize = a.origWidth === b.origWidth && a.origHeight === b.origHeight;
  const ratioA = a.origWidth / a.origHeight;
  const ratioB = b.origWidth / b.origHeight;
  if (!sameSize && Math.abs(ratioA - ratioB) / ratioA > ASPECT_TOLERANCE) {
    return false;
  }

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
  const limits = sameSize ? SAME_SIZE : RESIZED;
  return (
    total / left.length <= limits.maxMeanDiff && worstCell <= limits.maxCellDiff
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
