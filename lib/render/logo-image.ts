import sharp from "sharp";
import { fromHex } from "./colour";
import type { LogoLayout } from "./layout";

// The logo drawn at its box size: kept as it is, or recoloured to a flat ink with its own alpha as the shape.
export async function logoImage(png: Buffer, logo: LogoLayout) {
  const { w, h } = logo.box;
  const sized = sharp(png)
    .ensureAlpha()
    .resize(w, h, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  if (!logo.ink) return sized.png().toBuffer();
  const [r, g, b] = fromHex(logo.ink);
  const alpha = await sized.clone().extractChannel(3).raw().toBuffer();
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r, g, b } },
  })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();
}
