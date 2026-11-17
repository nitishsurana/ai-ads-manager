import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import sharp from "sharp";
import type { Fal } from "../types";

export type FalFault = "slow" | "fail";

const MASK_SIDE = 512;
const BACKGROUND_DISTANCE = 40;

// The product is whatever differs from the colour along the photo's border: right for the plain-background photos the pipeline cuts out, rough for anything else.
async function borderMask(image: Uint8Array) {
  const { data, info } = await sharp(image)
    .flatten({ background: "#ffffff" })
    .resize(MASK_SIDE, MASK_SIDE, { fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const at = (x: number, y: number) => (y * width + x) * 3;
  const corner = [0, 1, 2].map((c) => data[at(0, 0) + c] ?? 0);
  const mask = Buffer.alloc(width * height);
  for (let i = 0; i < mask.length; i++) {
    const far = [0, 1, 2].some(
      (c) =>
        Math.abs((data[i * 3 + c] ?? 0) - (corner[c] ?? 0)) >
        BACKGROUND_DISTANCE,
    );
    mask[i] = far ? 255 : 0;
  }
  return sharp(mask, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

// A vertical gradient whose colours come from the instruction, painted where the mask is white.
async function paintBackground(
  canvas: Uint8Array,
  mask: Uint8Array,
  key: string,
) {
  const [image, edit] = await Promise.all([
    sharp(canvas).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(mask).greyscale().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const { width, height } = image.info;
  const hash = createHash("sha256").update(key).digest();
  const top = [0, 1, 2].map((c) => 90 + ((hash[c] ?? 0) % 120));
  const bottom = [3, 4, 5].map((c) => 30 + ((hash[c] ?? 0) % 100));
  const out = Buffer.from(image.data);
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if ((edit.data[p] ?? 0) <= 127) continue;
      for (let c = 0; c < 3; c++) {
        out[p * 3 + c] = Math.round(
          (top[c] ?? 0) * (1 - t) + (bottom[c] ?? 0) * t,
        );
      }
    }
  }
  return sharp(out, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

// Answers the round's Fal calls without a model, for the end-to-end tests and the committed render fixtures. A fault makes the first call overrun, or every call throw, so a round fails or times out in the backgrounds stage.
export function createScriptedFal(options: {
  fault: FalFault | null;
  slowMs: number;
}): Fal {
  // The slow fault stalls one call, which is enough to overrun the deadline.
  let stalled = false;
  async function gate() {
    if (options.fault === "fail") throw new Error("fake fault: fal failed");
    if (options.fault === "slow" && !stalled) {
      stalled = true;
      await sleep(options.slowMs);
    }
  }
  return {
    async backgroundMask({ image }) {
      await gate();
      return borderMask(image);
    },
    async backgroundEdit({ canvas, mask, instruction, seed }) {
      await gate();
      return paintBackground(canvas, mask, `${instruction}:${seed}`);
    },
  };
}
