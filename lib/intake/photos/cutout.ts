import sharp from "sharp";

// The photo with the mask as its alpha channel.
export async function makeCutout(work: Buffer, mask: Buffer) {
  const { width, height } = await sharp(work).metadata();
  const [alpha, rgb] = await Promise.all([
    sharp(mask)
      .resize(width, height, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer(),
    sharp(work).removeAlpha().raw().toBuffer(),
  ]);
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = rgb[i * 3] ?? 0;
    rgba[i * 4 + 1] = rgb[i * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = rgb[i * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = alpha[i] ?? 0;
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}
