import convertHeic from "heic-convert";
import sharp from "sharp";

// Sharp's libvips cache holds decoded images between calls; the stage handles up to 10 large photos at a time.
sharp.cache(false);

const WORK_MAX_SIDE = 2048;
const WORK_QUALITY = 90;

// The working copy feeds the model copy, so its settings are part of the model replay key too.
export const WORK_COPY_VERSION = `${WORK_MAX_SIDE}-q${WORK_QUALITY}`;
const HASH_SIDE = 16;
// About 7000x7000: far above real product photos (3000x3000 is 9 MP) but caps decode memory (about 150 MB of RGB each, 10 at a time).
const MAX_INPUT_PIXELS = 50_000_000;
// AVIF shares the mif1 brand and goes to sharp.
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx"]);

export class UnreadableImageError extends Error {}

export type PreparedImage = {
  sha256: string;
  origWidth: number;
  origHeight: number;
  work: Buffer;
  workType: "image/jpeg" | "image/png";
  // 16x16 RGB of the working copy, hex: the colour-aware comparison hash.
  hash: string;
};

function isHeic(bytes: Buffer) {
  return (
    bytes.subarray(4, 8).toString("latin1") === "ftyp" &&
    HEIC_BRANDS.has(bytes.subarray(8, 12).toString("latin1"))
  );
}

async function decodable(original: Buffer) {
  if (!isHeic(original)) return original;
  return Buffer.from(
    await convertHeic({ buffer: original, format: "JPEG", quality: 0.92 }),
  );
}

async function decode(original: Buffer, sha256: string) {
  const source = await decodable(original);
  const open = () => sharp(source, { limitInputPixels: MAX_INPUT_PIXELS });
  const { width, height, orientation, hasAlpha } = await open().metadata();
  if (!width || !height) throw new Error("image has no dimensions");
  const swapped = orientation !== undefined && orientation >= 5;

  const image = open().rotate().resize(WORK_MAX_SIDE, WORK_MAX_SIDE, {
    fit: "inside",
    withoutEnlargement: true,
  });
  const work = await (
    hasAlpha ? image.png() : image.jpeg({ quality: WORK_QUALITY })
  ).toBuffer();

  const pixels = await sharp(work)
    .flatten({ background: "#ffffff" })
    .resize(HASH_SIDE, HASH_SIDE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  return {
    sha256,
    origWidth: swapped ? height : width,
    origHeight: swapped ? width : height,
    work,
    workType: hasAlpha ? "image/png" : "image/jpeg",
    hash: pixels.toString("hex"),
  } satisfies PreparedImage;
}

// The caller hashes the original bytes first so byte-identical copies never get decoded.
export async function prepareImage(
  original: Buffer,
  sha256: string,
): Promise<PreparedImage> {
  try {
    return await decode(original, sha256);
  } catch (error) {
    throw new UnreadableImageError("image could not be decoded", {
      cause: error,
    });
  }
}
