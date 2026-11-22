export type LightDirection =
  "left" | "upper left" | "above" | "upper right" | "right";

const SIDE = 96;
const OPAQUE = 250;
// A neighbouring pair is shading only when it changes little in brightness and not at all in colour; bigger steps are the product's own edges (straps, labels, caps).
const MAX_STEP = 0.08;
const MAX_CHROMA_STEP = 0.02;
const MIN_KEPT_SHARE = 0.3;
// The mean gradient across the whole box, in log-luminance. The full vector must clear it by this margin, so a borderline product doesn't flip sector between library versions.
const MIN_MAGNITUDE = 0.15;
const MARGIN = 1.25;
// A product is one part when no second connected part holds this share of the opaque area; a set of parts has no single light.
const PART_SHARE = 0.05;

type Cell = { luma: number; r: number; g: number };
type Grid = { cells: (Cell | null)[]; width: number; height: number };

// Box-downsampled to at most SIDE px on the long side; a cell is kept only where every source pixel is opaque.
function downsample(
  rgba: Buffer,
  width: number,
  height: number,
  step: number,
): Grid {
  const w = Math.ceil(width / step);
  const h = Math.ceil(height / step);
  const cells: (Cell | null)[] = [];
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const sum = [0, 0, 0];
      let count = 0;
      let opaque = true;
      for (let y = cy * step; y < Math.min(height, (cy + 1) * step); y++) {
        for (let x = cx * step; x < Math.min(width, (cx + 1) * step); x++) {
          const i = (y * width + x) * 4;
          if ((rgba[i + 3] ?? 0) < OPAQUE) opaque = false;
          for (let c = 0; c < 3; c++)
            sum[c] = (sum[c] ?? 0) + (rgba[i + c] ?? 0);
          count++;
        }
      }
      if (!opaque) {
        cells.push(null);
        continue;
      }
      const [r, g, b] = sum.map((v) => v / count) as [number, number, number];
      const total = r + g + b || 1;
      cells.push({
        luma: Math.log((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 + 0.05),
        r: r / total,
        g: g / total,
      });
    }
  }
  return { cells, width: w, height: h };
}

// The mean shading gradient over the pairs inside `within`, scaled by the box so a long or a wide product reads alike, and the share of opaque pairs it kept.
function gradient(
  { cells, width, height }: Grid,
  within: { x0: number; x1: number; y0: number; y1: number },
) {
  const sum = { x: 0, y: 0 };
  const n = { x: 0, y: 0 };
  let opaque = 0;
  let kept = 0;
  const pair = (a: Cell | null | undefined, b: Cell | null | undefined) => {
    if (!a || !b) return null;
    opaque++;
    const step = b.luma - a.luma;
    if (
      Math.abs(step) >= MAX_STEP ||
      Math.hypot(b.r - a.r, b.g - a.g) >= MAX_CHROMA_STEP
    ) {
      return null;
    }
    kept++;
    return step;
  };
  for (let y = within.y0; y < within.y1; y++) {
    for (let x = within.x0; x < within.x1; x++) {
      const here = cells[y * width + x];
      const across =
        x + 1 < within.x1 ? pair(here, cells[y * width + x + 1]) : null;
      const down =
        y + 1 < within.y1 ? pair(here, cells[(y + 1) * width + x]) : null;
      if (across !== null) {
        sum.x += across;
        n.x++;
      }
      if (down !== null) {
        sum.y += down;
        n.y++;
      }
    }
  }
  return {
    x: n.x ? (sum.x / n.x) * width : 0,
    y: n.y ? (sum.y / n.y) * height : 0,
    keptShare: opaque ? kept / opaque : 0,
  };
}

// Whether more than one 4-connected part of the opaque cells holds at least PART_SHARE of them.
function isSeveralParts({ cells, width, height }: Grid) {
  const seen = new Uint8Array(cells.length);
  const sizes: number[] = [];
  for (let start = 0; start < cells.length; start++) {
    if (!cells[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let size = 0;
    while (stack.length > 0) {
      const i = stack.pop() ?? 0;
      size++;
      const x = i % width;
      for (const n of [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        i - width,
        i + width,
      ]) {
        if (n >= 0 && n < width * height && cells[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    sizes.push(size);
  }
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return sizes.filter((size) => size >= PART_SHARE * total).length > 1;
}

const SECTORS: LightDirection[] = [
  "right",
  "upper right",
  "above",
  "upper left",
  "left",
];

// Five 45 degree sectors; left and right reach 22.5 degrees below horizontal, anything further below gives none.
function sector({ x, y }: { x: number; y: number }) {
  const degrees = (Math.atan2(-y, x) * 180) / Math.PI;
  if (degrees >= 0) return SECTORS[Math.round(degrees / 45)] ?? null;
  if (degrees >= -22.5) return "right";
  return degrees <= -157.5 ? "left" : null;
}

// Where the light on a product comes from, read from its shading: the mean gradient of log-luminance over neighbouring opaque pixels, which points toward the light. Null for a flat-lit or unevenly shaded product, which is when both halves of the box (split across the gradient's main axis) don't agree.
export function lightDirection(
  rgba: Buffer,
  width: number,
  height: number,
): LightDirection | null {
  const grid = downsample(
    rgba,
    width,
    height,
    Math.max(1, Math.ceil(Math.max(width, height) / SIDE)),
  );
  if (isSeveralParts(grid)) return null;
  const whole = { x0: 0, x1: grid.width, y0: 0, y1: grid.height };
  const full = gradient(grid, whole);
  const direction = sector(full);
  if (
    !direction ||
    full.keptShare < MIN_KEPT_SHARE ||
    Math.hypot(full.x, full.y) < MIN_MAGNITUDE * MARGIN
  ) {
    return null;
  }
  const byColumns = Math.abs(full.x) >= Math.abs(full.y);
  const mid = byColumns ? grid.width / 2 : grid.height / 2;
  const halves = byColumns
    ? [
        { ...whole, x1: Math.ceil(mid) },
        { ...whole, x0: Math.floor(mid) },
      ]
    : [
        { ...whole, y1: Math.ceil(mid) },
        { ...whole, y0: Math.floor(mid) },
      ];
  return halves.every((half) => sector(gradient(grid, half)) === direction)
    ? direction
    : null;
}
