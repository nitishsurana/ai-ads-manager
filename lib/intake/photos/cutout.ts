import sharp from "sharp";

// The photo with the mask as its alpha channel.
export async function makeCutout(work: Buffer, mask: Buffer) {
  const { width, height } = await sharp(work).metadata();
  const alpha = await sharp(mask)
    .resize(width, height, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  return sharp(work)
    .removeAlpha()
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}
