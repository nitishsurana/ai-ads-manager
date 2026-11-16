import sharp from "sharp";
import { toHex, type Rgb } from "./colour";

export type Rgba = { data: Buffer; width: number; height: number };

const MAX_SIDE = 2048;
// A logo is never a photo: 25 MP is far above any real file and caps decode memory.
const MAX_INPUT_PIXELS = 25_000_000;
const NEAR_WHITE = 235;
const OPAQUE = 250;
const VISIBLE = 8;
const SOLID = 200;
// Colours closer than this (RGB distance) are one colour: anti-aliasing and JPEG noise.
const MERGE_DISTANCE = 70;
const MIN_COLOUR_SHARE = 0.04;
const FLAT_TOLERANCE = 30;

export async function decodeRgba(
  input: Buffer,
  options?: { density?: number },
): Promise<Rgba> {
  const { data, info } = await sharp(input, {
    limitInputPixels: MAX_INPUT_PIXELS,
    ...(options?.density && { density: options.density }),
  })
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export function toPng({ data, width, height }: Rgba) {
  return sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

export function transparentShare({ data }: Rgba) {
  let clear = 0;
  for (let i = 3; i < data.length; i += 4)
    if ((data[i] ?? 255) < OPAQUE) clear++;
  return clear / (data.length / 4);
}

function* borderIndexes({ width, height }: Rgba) {
  for (let x = 0; x < width; x++) {
    yield x;
    yield (height - 1) * width + x;
  }
  for (let y = 1; y < height - 1; y++) {
    yield y * width;
    yield y * width + width - 1;
  }
}

const isNearWhite = (data: Buffer, p: number) =>
  (data[p * 4 + 3] ?? 0) >= OPAQUE &&
  Math.min(data[p * 4] ?? 0, data[p * 4 + 1] ?? 0, data[p * 4 + 2] ?? 0) >=
    NEAR_WHITE;

// The opaque part of the border is near-white all the way round. Mostly-transparent images count too: a white box with rounded corners has transparent corners but opaque white sides.
export function hasNearWhiteBox(image: Rgba) {
  let [opaque, white, total] = [0, 0, 0];
  for (const p of borderIndexes(image)) {
    total++;
    if ((image.data[p * 4 + 3] ?? 0) < OPAQUE) continue;
    opaque++;
    if (isNearWhite(image.data, p)) white++;
  }
  return opaque >= total / 2 && white / opaque >= 0.98;
}

// Visits every pixel reachable from the seeds through passable ones, once across calls that share `seen`, and returns them.
function fill(
  { width, height }: Rgba,
  seeds: Iterable<number>,
  passable: (p: number) => boolean,
  seen = new Uint8Array(width * height),
) {
  const reached: number[] = [];
  const stack: number[] = [];
  for (const p of seeds) {
    if (!seen[p] && passable(p)) {
      seen[p] = 1;
      stack.push(p);
    }
  }
  for (let p = stack.pop(); p !== undefined; p = stack.pop()) {
    reached.push(p);
    const x = p % width;
    const next = [
      x > 0 ? p - 1 : -1,
      x < width - 1 ? p + 1 : -1,
      p >= width ? p - width : -1,
      p < width * (height - 1) ? p + width : -1,
    ];
    for (const q of next) {
      if (q >= 0 && !seen[q] && passable(q)) {
        seen[q] = 1;
        stack.push(q);
      }
    }
  }
  return reached;
}

// Flood fill from the edges: white that the artwork encloses (a ring, a counter) is never reached, so it stays.
export function removeNearWhiteBox(image: Rgba): Rgba {
  const data = Buffer.from(image.data);
  for (const p of fill(image, borderIndexes(image), (p) =>
    isNearWhite(data, p),
  )) {
    data[p * 4 + 3] = 0;
  }
  return { data, width: image.width, height: image.height };
}

// Enclosed white regions smaller than this share of the ink are letter counters; a larger one (an emblem's field) is part of the artwork.
const COUNTER_SHARE = 0.5;
// Below this share of the ink colour's distance from white a pixel is paper, not ink.
const PAPER = 0.04;

const brightness = (data: Buffer, p: number) =>
  0.299 * (data[p * 4] ?? 0) +
  0.587 * (data[p * 4 + 1] ?? 0) +
  0.114 * (data[p * 4 + 2] ?? 0);

// A pixel further than this (RGB distance) from the white-to-ink line is a different colour, such as a small accent, and is left alone.
const OFF_LINE = 60;

// For a one-ink logo on a removed white box: alpha follows the distance from white (so anti-aliased edges fade instead of leaving a light fringe), and small enclosed white counters become transparent. Large enclosed white stays opaque, and so do pixels off the white-to-ink line (an accent colour).
export function inkMask(image: Rgba, ink: Rgb): Rgba {
  const { width, height } = image;
  const data = Buffer.from(image.data);
  const inkBrightness = 0.299 * ink[0] + 0.587 * ink[1] + 0.114 * ink[2];
  const span = 255 - inkBrightness;
  const strength = (p: number) =>
    Math.min(1, Math.max(0, (255 - brightness(data, p)) / span));
  const isPaper = (p: number) =>
    (data[p * 4 + 3] ?? 0) >= OPAQUE && strength(p) < PAPER;

  const count = width * height;
  let inkArea = 0;
  for (let p = 0; p < count; p++) {
    if ((data[p * 4 + 3] ?? 0) >= OPAQUE && strength(p) >= 0.5) inkArea++;
  }

  const labelled = new Uint8Array(count);
  const keep = new Uint8Array(count);
  for (let start = 0; start < count; start++) {
    if (labelled[start] || !isPaper(start)) continue;
    const region = fill(image, [start], isPaper, labelled);
    if (region.length >= inkArea * COUNTER_SHARE) {
      for (const p of region) keep[p] = 1;
    }
  }

  for (let p = 0; p < count; p++) {
    const alpha = data[p * 4 + 3] ?? 0;
    if (alpha === 0 || keep[p]) continue;
    const t = strength(p);
    const onLine =
      Math.hypot(
        ...[0, 1, 2].map(
          (c) => (data[p * 4 + c] ?? 0) - (255 - t * (255 - (ink[c] ?? 0))),
        ),
      ) <= OFF_LINE;
    if (!onLine) continue;
    data[p * 4] = ink[0];
    data[p * 4 + 1] = ink[1];
    data[p * 4 + 2] = ink[2];
    data[p * 4 + 3] = t < PAPER ? 0 : Math.round(alpha * t);
  }
  return { data, width, height };
}

// Crops to the visible artwork; null when nothing is visible.
export function trimToArtwork({ data, width, height }: Rgba): Rgba | null {
  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) <= VISIBLE) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return null;
  const [w, h] = [right - left + 1, bottom - top + 1];
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    data.copy(
      out,
      y * w * 4,
      ((top + y) * width + left) * 4,
      ((top + y) * width + right + 1) * 4,
    );
  }
  return { data: out, width: w, height: h };
}

const distance = (a: Rgb, b: Rgb) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const CORE_TOLERANCE = 24;

// A core pixel agrees with its solid neighbours; edge pixels (anti-aliasing, JPEG halos) blend two colours and would read as extra ones.
function isCore({ data, width, height }: Rgba, p: number) {
  const [x, y] = [p % width, Math.floor(p / width)];
  const neighbours = [
    x > 0 ? p - 1 : -1,
    x < width - 1 ? p + 1 : -1,
    y > 0 ? p - width : -1,
    y < height - 1 ? p + width : -1,
  ];
  return neighbours.every((q) => {
    if (q < 0 || (data[q * 4 + 3] ?? 0) < SOLID) return true;
    return [0, 1, 2].every(
      (c) =>
        Math.abs((data[q * 4 + c] ?? 0) - (data[p * 4 + c] ?? 0)) <=
        CORE_TOLERANCE,
    );
  });
}

// Core pixels in 4-bit buckets, merged when close, keeping those with a real share of the artwork.
export function dominantColours(
  image: Rgba,
  options: { ignoreNearWhite?: boolean } = {},
): { hex: string; share: number }[] {
  const buckets = new Map<number, { n: number; sum: Rgb }>();
  let solid = 0;
  const { data } = image;
  const count = (core: boolean) => {
    for (let p = 0; p < data.length / 4; p++) {
      const i = p * 4;
      if ((data[i + 3] ?? 0) < SOLID) continue;
      const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
      if (options.ignoreNearWhite && Math.min(r, g, b) >= NEAR_WHITE) continue;
      if (core && !isCore(image, p)) continue;
      solid++;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) ?? { n: 0, sum: [0, 0, 0] as Rgb };
      bucket.n++;
      bucket.sum = [bucket.sum[0] + r, bucket.sum[1] + g, bucket.sum[2] + b];
      buckets.set(key, bucket);
    }
  };
  count(true);
  // Artwork thinner than a pixel or two has no core.
  if (solid === 0) count(false);
  if (solid === 0) return [];

  const clusters: { n: number; sum: Rgb; mean: Rgb }[] = [];
  for (const { n, sum } of [...buckets.values()].sort((a, b) => b.n - a.n)) {
    const mean: Rgb = [sum[0] / n, sum[1] / n, sum[2] / n];
    const near = clusters.find((c) => distance(c.mean, mean) < MERGE_DISTANCE);
    if (near) {
      near.n += n;
      near.sum = [
        near.sum[0] + sum[0],
        near.sum[1] + sum[1],
        near.sum[2] + sum[2],
      ];
    } else clusters.push({ n, sum, mean });
  }
  const ranked = clusters
    .map((c) => ({
      hex: toHex([c.sum[0] / c.n, c.sum[1] / c.n, c.sum[2] / c.n]),
      share: c.n / solid,
    }))
    .sort((a, b) => b.share - a.share);
  const kept = ranked.filter((c) => c.share >= MIN_COLOUR_SHARE);
  return kept.length > 0 ? kept : ranked.slice(0, 1);
}

// Flat means the visible border is one colour within a small tolerance (a plain backdrop), or the image is transparent.
export function hasFlatBackground(image: Rgba) {
  if (transparentShare(image) >= 0.05) return true;
  const { data } = image;
  let [r, g, b, n] = [0, 0, 0, 0];
  for (const p of borderIndexes(image)) {
    r += data[p * 4] ?? 0;
    g += data[p * 4 + 1] ?? 0;
    b += data[p * 4 + 2] ?? 0;
    n++;
  }
  const mean: Rgb = [r / n, g / n, b / n];
  let flat = 0;
  for (const p of borderIndexes(image)) {
    const px: Rgb = [
      data[p * 4] ?? 0,
      data[p * 4 + 1] ?? 0,
      data[p * 4 + 2] ?? 0,
    ];
    if (distance(px, mean) <= FLAT_TOLERANCE) flat++;
  }
  return flat / n >= 0.95;
}

// Transparency is shown as magenta, the colour the logo-check prompt expects; the model sees at most 1024 px.
export function checkJpeg({ data, width, height }: Rgba) {
  return sharp(data, { raw: { width, height, channels: 4 } })
    .flatten({ background: "#ff00ff" })
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export const CHECK_COPY_VERSION = "jpeg-1024-q85-magenta";
