import sharp from "sharp";
import { GRADE_MAX, GRADE_STRENGTH } from "@/lib/config";
import type { Box } from "@/lib/render";
import type { Grade } from "../types";
import { neighbours } from "./holes";

// Alpha under this is outside the silhouette Bria is told to keep.
export const SILHOUETTE_ALPHA = 11;
// What the outermost and the next pixel inside the silhouette keep of their alpha, so the edge blends into Bria's repaint without a strap thinning away.
const RAMP = [0.5, 0.85] as const;

const SATURATION_MAX = 0.15;
const LUMA_MIN = 0.25;
const LUMA_MAX = 0.95;
// Under this share of the scene's pixels there is too little neutral to read a cast from.
const NEUTRAL_MIN_SHARE = 0.05;
const WEIGHTS = [0.2126, 0.7152, 0.0722] as const;

const luma = (r: number, g: number, b: number) =>
  WEIGHTS[0] * r + WEIGHTS[1] * g + WEIGHTS[2] * b;

// The colour gains that nudge the product toward the scene's cast, read from the scene's near-neutral pixels (the product's silhouette left out): each channel's mean over the mean luminance, pulled by GRADE_STRENGTH, keeping luminance, with one uniform shrink so no channel moves more than GRADE_MAX. [1, 1, 1] when the scene has too little neutral.
export function estimateGrade(
  scene: { data: Buffer; width: number; height: number },
  product: { rgba: Buffer; box: Box },
): Grade {
  const { data, width, height } = scene;
  const { rgba, box } = product;
  const sum = [0, 0, 0];
  let neutral = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [px, py] = [x - box.x, y - box.y];
      const inBox = px >= 0 && py >= 0 && px < box.w && py < box.h;
      if (inBox && (rgba[(py * box.w + px) * 4 + 3] ?? 0) >= SILHOUETTE_ALPHA) {
        continue;
      }
      const i = (y * width + x) * 3;
      const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
      const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
      const lightness = luma(r, g, b) / 255;
      if (
        max === 255 ||
        min === 0 ||
        (max - min) / max >= SATURATION_MAX ||
        lightness < LUMA_MIN ||
        lightness > LUMA_MAX
      ) {
        continue;
      }
      neutral++;
      sum[0] = (sum[0] ?? 0) + r;
      sum[1] = (sum[1] ?? 0) + g;
      sum[2] = (sum[2] ?? 0) + b;
    }
  }
  if (neutral < NEUTRAL_MIN_SHARE * width * height) return [1, 1, 1];

  const [sr = 0, sg = 0, sb = 0] = sum;
  const mean = luma(sr, sg, sb);
  const raw = sum.map((v) => 1 + GRADE_STRENGTH * (v / mean - 1));
  const norm = luma(raw[0] ?? 1, raw[1] ?? 1, raw[2] ?? 1);
  const gains = raw.map((g) => g / norm);
  const shrink = Math.min(
    1,
    GRADE_MAX / Math.max(...gains.map((g) => Math.abs(g - 1))),
  );
  return gains.map(
    (g) => Math.round((1 + shrink * (g - 1)) * 1000) / 1000,
  ) as Grade;
}

// The cut-out as it is pasted over a Bria scene: its colours scaled by the grade, and the alpha of its outermost two rings of pixels ramped down. Pixels outside the silhouette keep their alpha, and the box edge counts as outside.
export async function finishProduct(png: Buffer, grade: Grade) {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const solid = (i: number) => (data[i * 4 + 3] ?? 0) >= SILHOUETTE_ALPHA;
  const ring = new Uint8Array(width * height);
  for (let i = 0; i < ring.length; i++) {
    if (!solid(i)) continue;
    const around = neighbours(i, width, height);
    if (around.length < 4 || around.some((n) => !solid(n))) ring[i] = 1;
  }
  for (let i = 0; i < ring.length; i++) {
    if (
      solid(i) &&
      !ring[i] &&
      neighbours(i, width, height).some((n) => ring[n] === 1)
    ) {
      ring[i] = 2;
    }
  }
  for (let i = 0; i < ring.length; i++) {
    for (let c = 0; c < 3; c++) {
      const at = i * 4 + c;
      data[at] = Math.min(255, Math.round((data[at] ?? 0) * (grade[c] ?? 1)));
    }
    const depth = ring[i] ?? 0;
    if (depth > 0) {
      data[i * 4 + 3] = Math.round(
        (data[i * 4 + 3] ?? 0) * (RAMP[depth - 1] ?? 1),
      );
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}
