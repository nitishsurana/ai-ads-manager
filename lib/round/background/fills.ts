import sharp from "sharp";
import type { BrandKit } from "@/lib/intake";
import { parseColour } from "@/lib/intake";
import { hexOf, hslToRgb, rgbToHsl, type Rgb } from "@/lib/render/colour";
import { CANVAS, type Box } from "@/lib/render";

const NEUTRAL: Rgb = [233, 228, 218];

// A brand colour for the flat and tonal backdrops: the primary, else whatever the palette has.
export function fillColour(palette: BrandKit["palette"]): Rgb {
  for (const value of [
    palette.primary,
    palette.secondary,
    palette.themeColour,
    palette.background,
  ]) {
    const colour = value ? parseColour(value) : null;
    if (colour) return colour;
  }
  return NEUTRAL;
}

function shade(colour: Rgb, change: number): Rgb {
  const [h, s, l] = rgbToHsl(colour);
  return hslToRgb(h, s, Math.min(0.95, Math.max(0.05, l + change)));
}

function backdropSvg(method: "solid" | "tonal", colour: Rgb) {
  const fill =
    method === "solid"
      ? `<rect width="100%" height="100%" fill="${hexOf(colour)}"/>`
      : `<defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${hexOf(shade(colour, 0.1))}"/>
            <stop offset="1" stop-color="${hexOf(shade(colour, -0.14))}"/>
          </linearGradient>
          <radialGradient id="r" cx="0.5" cy="0.6" r="0.6">
            <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
            <stop offset="1" stop-color="#fff" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <rect width="100%" height="100%" fill="url(#r)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}">${fill}</svg>`;
}

// A soft ellipse under the product, as in the design, so it doesn't float.
function shadowSvg(product: Box) {
  const cx = product.x + product.w / 2;
  const cy = product.y + product.h - 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}">
    <defs><filter id="b" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="14"/></filter></defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${product.w * 0.46}" ry="${Math.max(10, product.w * 0.04)}" fill="#000" fill-opacity="0.28" filter="url(#b)"/>
  </svg>`;
}

export async function fillBackground(
  method: "solid" | "tonal",
  colour: Rgb,
  product: { png: Buffer; box: Box },
) {
  return sharp(Buffer.from(backdropSvg(method, colour)))
    .composite([
      { input: Buffer.from(shadowSvg(product.box)) },
      { input: product.png, left: product.box.x, top: product.box.y },
    ])
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
