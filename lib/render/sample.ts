import sharp from "sharp";
import type { Box } from "./canvas";
import { fromHex, type Backdrop, type Rgb } from "./colour";
import { scrimOpacityAt, type Scrim } from "./scrim";

export type Pixels = { data: Buffer; width: number; height: number };

const MAX_SAMPLES = 20_000;

export async function decodePixels(image: Buffer): Promise<Pixels> {
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const under = (colour: Rgb, scrim: Scrim, y: number): Rgb => {
  const opacity = scrimOpacityAt(scrim, y);
  const over = fromHex(scrim.colour);
  return [0, 1, 2].map(
    (c) => (colour[c] ?? 0) * (1 - opacity) + (over[c] ?? 0) * opacity,
  ) as Rgb;
};

// Reads the area under a box: its mean, the colours at the 2nd and 98th brightness percentiles, and how busy it is.
export function sampleBackdrop(
  pixels: Pixels,
  box: Box,
  scrim: Scrim | null = null,
): Backdrop {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(pixels.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(pixels.height, Math.ceil(box.y + box.h));
  const stride = Math.max(
    1,
    Math.ceil(Math.sqrt(((x1 - x0) * (y1 - y0)) / MAX_SAMPLES)),
  );
  const samples: { luminance: number; rgb: Rgb }[] = [];
  for (let y = y0; y < y1; y += stride) {
    for (let x = x0; x < x1; x += stride) {
      const i = (y * pixels.width + x) * 3;
      const own: Rgb = [
        pixels.data[i] ?? 0,
        pixels.data[i + 1] ?? 0,
        pixels.data[i + 2] ?? 0,
      ];
      const rgb = scrim ? under(own, scrim, y) : own;
      samples.push({
        luminance: 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2],
        rgb,
      });
    }
  }
  if (samples.length === 0) throw new Error("sample: the box is off the image");
  samples.sort((a, b) => a.luminance - b.luminance);
  const n = samples.length;
  const mean = [0, 1, 2].map((c) =>
    Math.round(samples.reduce((sum, s) => sum + (s.rgb[c] ?? 0), 0) / n),
  ) as Rgb;
  const meanLuminance = samples.reduce((sum, s) => sum + s.luminance, 0) / n;
  const busy = Math.sqrt(
    samples.reduce((sum, s) => sum + (s.luminance - meanLuminance) ** 2, 0) / n,
  );
  return {
    mean,
    dark: samples[Math.floor(n * 0.02)]?.rgb ?? mean,
    light: samples[Math.min(n - 1, Math.floor(n * 0.98))]?.rgb ?? mean,
    busy,
  };
}
