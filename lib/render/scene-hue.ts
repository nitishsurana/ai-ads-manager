import type { Box } from "./canvas";
import { rgbToHsl, type Rgb } from "./colour";
import type { Pixels } from "./sample";

const STRIDE = 4;
const BUCKETS = 24;
const BUCKET_DEGREES = 360 / BUCKETS;
const MIN_SATURATION = 0.25;
const MIN_LIGHTNESS = 0.15;
const MAX_LIGHTNESS = 0.9;
// Below this share of chromatic pixels a scene is neutral and has no hue of its own.
const MIN_CHROMATIC_SHARE = 0.05;

// The hue most of the chromatic pixels share, from a histogram of 15° buckets smoothed 1-2-1 with their neighbours; ties go to the lowest bucket. Null when there are none.
function dominantHue(
  pixels: Pixels,
  counted: (x: number, y: number) => boolean,
) {
  const counts = new Array<number>(BUCKETS).fill(0);
  let seen = 0;
  let chromatic = 0;
  for (let y = 0; y < pixels.height; y += STRIDE) {
    for (let x = 0; x < pixels.width; x += STRIDE) {
      if (!counted(x, y)) continue;
      seen++;
      const i = (y * pixels.width + x) * 3;
      const rgb: Rgb = [
        pixels.data[i] ?? 0,
        pixels.data[i + 1] ?? 0,
        pixels.data[i + 2] ?? 0,
      ];
      const [hue, saturation, lightness] = rgbToHsl(rgb);
      if (
        saturation < MIN_SATURATION ||
        lightness < MIN_LIGHTNESS ||
        lightness > MAX_LIGHTNESS
      ) {
        continue;
      }
      chromatic++;
      const bucket = Math.floor(hue / BUCKET_DEGREES) % BUCKETS;
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
  }
  if (chromatic === 0 || chromatic / seen < MIN_CHROMATIC_SHARE) return null;
  const smoothed = counts.map(
    (count, i) =>
      (counts[(i + BUCKETS - 1) % BUCKETS] ?? 0) +
      2 * count +
      (counts[(i + 1) % BUCKETS] ?? 0),
  );
  const top = smoothed.indexOf(Math.max(...smoothed));
  return top * BUCKET_DEGREES + BUCKET_DEGREES / 2;
}

// The hue of the scene behind the product, for the button to follow. A neutral scene (white linen, grey fur) borrows the product's own hue; null when both are neutral.
export function sceneHue(pixels: Pixels, product: Box | null) {
  const inProduct = (x: number, y: number) =>
    product !== null &&
    x >= product.x &&
    x < product.x + product.w &&
    y >= product.y &&
    y < product.y + product.h;
  return (
    dominantHue(pixels, (x, y) => !inProduct(x, y)) ??
    (product ? dominantHue(pixels, inProduct) : null)
  );
}
