import sharp from "sharp";
import { WORK_COPY_VERSION } from "./prepare";

const THUMB_SIDE = 400;
const MODEL_SIDE = 1024;
const MODEL_QUALITY = 85;

// Part of the model replay key: change the size or format and recorded answers stop matching.
export const MODEL_COPY_VERSION = `work-${WORK_COPY_VERSION}+jpeg-${MODEL_SIDE}-q${MODEL_QUALITY}-white`;

function smallJpeg(work: Buffer, side: number, quality: number) {
  return sharp(work)
    .flatten({ background: "#ffffff" })
    .resize(side, side, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
}

export const thumbnail = (work: Buffer) => smallJpeg(work, THUMB_SIDE, 80);

export const modelCopy = (work: Buffer) =>
  smallJpeg(work, MODEL_SIDE, MODEL_QUALITY);
