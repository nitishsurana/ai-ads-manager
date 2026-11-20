import sharp from "sharp";
import { countMainShapes } from "./mask";
import type { PhotoTier } from "./types";

const ANALYSIS_SIDE = 1024;
const STATS_SIDE = 256;
const THRESHOLD = 128;
// Squared RGB distance from the backdrop colour (28) under which a pixel is backdrop.
const TOLERANCE_SQ = 28 * 28;
const UNIFORM_BORDER_SHARE = 0.95;
// Foreground pieces smaller than this share of the frame are specks.
const MIN_PIECE_SHARE = 0.002;
const FEATHER = 1;

// The model mask must be under this share of the backdrop foreground for a photo that is not a gift set.
const MODEL_SHARE_LIMIT = 0.5;
const CONTAINED_MIN = 0.95;
// Above this the "foreground" is the frame itself, not a set on a backdrop.
const FOREGROUND_MAX = 0.97;

export type MaskChoice = "backdrop" | "model";

export type MaskStats = {
  modelShare: number;
  foregroundShare: number;
  // The share of the model mask that lies inside the backdrop foreground.
  containedShare: number;
  foregroundShapes: number;
};

type Frame = { width: number; height: number };

const median = (values: number[]) =>
  values.sort((a, b) => a - b)[values.length >> 1] ?? 0;

function borderCells({ width, height }: Frame) {
  const cells: number[] = [];
  for (let x = 0; x < width; x++) cells.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++)
    cells.push(y * width, y * width + width - 1);
  return cells;
}

// Grows the cells queued in queue[start..end) into every neighbour `accepts` lets through; returns the new end of the queue.
function spread(
  queue: Int32Array,
  start: number,
  end: number,
  seen: Uint8Array,
  { width, height }: Frame,
  accepts: (cell: number) => boolean,
  diagonal: boolean,
) {
  let tail = end;
  for (let head = start; head < tail; head++) {
    const cell = queue[head] ?? 0;
    const x = cell % width;
    const y = (cell - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx === 0 && dy === 0) || (!diagonal && dx !== 0 && dy !== 0)) {
          continue;
        }
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (seen[next] || !accepts(next)) continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
  }
  return tail;
}

// Within RGB distance TOLERANCE of the backdrop colour: the one test for both the border and the fill.
function nearBackdrop(rgb: Buffer, cell: number, backdrop: number[]) {
  let sum = 0;
  for (let c = 0; c < 3; c++) {
    const d = (rgb[cell * 3 + c] ?? 0) - (backdrop[c] ?? 0);
    sum += d * d;
  }
  return sum <= TOLERANCE_SQ;
}

// Foreground cells (1) are the ones the backdrop does not reach from the border, so holes inside the set stay foreground.
function foreground(rgb: Buffer, frame: Frame, backdrop: number[]) {
  const size = frame.width * frame.height;
  const near = (cell: number) => nearBackdrop(rgb, cell, backdrop);
  const queue = new Int32Array(size);
  const reached = new Uint8Array(size);
  let end = 0;
  for (const cell of borderCells(frame)) {
    if (!reached[cell] && near(cell)) {
      reached[cell] = 1;
      queue[end++] = cell;
    }
  }
  spread(queue, 0, end, reached, frame, near, false);
  const cells = Uint8Array.from(reached, (v) => 1 - v);

  const minimum = size * MIN_PIECE_SHARE;
  const seen = new Uint8Array(size);
  for (let cell = 0; cell < size; cell++) {
    if (!cells[cell] || seen[cell]) continue;
    seen[cell] = 1;
    queue[0] = cell;
    const piece = spread(queue, 0, 1, seen, frame, (c) => cells[c] === 1, true);
    if (piece >= minimum) continue;
    for (let i = 0; i < piece; i++) cells[queue[i] ?? 0] = 0;
  }
  return cells;
}

// What the photo shows besides its backdrop, when the backdrop is one colour all round the border; mask is null otherwise. The mask is the photo's size, with a soft edge.
export async function backdropMask(work: Buffer) {
  const { width, height } = await sharp(work).metadata();
  if (!width || !height) throw new Error("backdrop: the photo has no size");
  const { data, info } = await sharp(work)
    .flatten({ background: "#ffffff" })
    .resize(ANALYSIS_SIDE, ANALYSIS_SIDE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const frame = { width: info.width, height: info.height };

  const border = borderCells(frame);
  const colour = [0, 1, 2].map((c) =>
    median(border.map((cell) => data[cell * 3 + c] ?? 0)),
  );
  const close = border.filter((cell) => nearBackdrop(data, cell, colour));
  const uniform = close.length / border.length >= UNIFORM_BORDER_SHARE;
  if (!uniform) return { uniform, mask: null, foregroundShare: 0 };

  const cells = foreground(data, frame, colour);
  const share = cells.reduce((sum, v) => sum + v, 0) / cells.length;
  const mask = await sharp(
    Uint8Array.from(cells, (v) => v * 255),
    {
      raw: { ...frame, channels: 1 },
    },
  )
    .resize(width, height, { kernel: "linear" })
    .blur(FEATHER)
    .png()
    .toBuffer();
  return { uniform, mask, foregroundShare: share };
}

// Everything either mask keeps, at the backdrop mask's size.
export async function unionMask(model: Buffer, backdrop: Buffer) {
  const { width, height } = await sharp(backdrop).metadata();
  const resized = await sharp(model)
    .flatten({ background: "#000000" })
    .greyscale()
    .resize(width, height, { fit: "fill" })
    .png()
    .toBuffer();
  return sharp(backdrop)
    .greyscale()
    .composite([{ input: resized, blend: "lighten" }])
    .png()
    .toBuffer();
}

async function cells(mask: Buffer) {
  const data = await sharp(mask)
    .flatten({ background: "#000000" })
    .greyscale()
    .resize(STATS_SIDE, STATS_SIDE, { fit: "fill" })
    .raw()
    .toBuffer();
  return Uint8Array.from(data, (v) => (v >= THRESHOLD ? 1 : 0));
}

const total = (values: Uint8Array) => values.reduce((sum, v) => sum + v, 0);

export async function maskStats(
  model: Buffer,
  backdrop: Buffer,
): Promise<MaskStats> {
  const [m, b] = await Promise.all([cells(model), cells(backdrop)]);
  const inside = m.reduce((sum, v, i) => sum + (v && b[i] ? 1 : 0), 0);
  return {
    modelShare: total(m) / m.length,
    foregroundShare: total(b) / b.length,
    containedShare: inside / Math.max(1, total(m)),
    foregroundShapes: await countMainShapes(backdrop),
  };
}

// Whether the photo's cut-out is the backdrop mask (the whole set, props and cards included) rather than the model's (the product alone).
export function chooseMask(
  input: MaskStats & { tier: PhotoTier; giftSet: boolean; uniform: boolean },
): MaskChoice {
  const { modelShare, foregroundShare } = input;
  const usable =
    input.tier !== "added_text" &&
    input.uniform &&
    foregroundShare >= modelShare &&
    foregroundShare < FOREGROUND_MAX;
  const missed =
    modelShare < foregroundShare * MODEL_SHARE_LIMIT &&
    input.containedShare >= CONTAINED_MIN &&
    input.foregroundShapes === 1;
  return usable && (input.giftSet || missed) ? "backdrop" : "model";
}
