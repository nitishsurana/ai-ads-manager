import type { PhotoWarning } from "./types";

const MIN_LONG_SIDE = 800;

export const isLowResolution = (width: number, height: number) =>
  Math.max(width, height) < MIN_LONG_SIDE;

// What the confirm screen flags on a photo that is kept.
export function photoWarnings(photo: {
  origWidth: number;
  origHeight: number;
  addedText: boolean;
}): PhotoWarning[] {
  return [
    ...(isLowResolution(photo.origWidth, photo.origHeight)
      ? (["low_resolution"] as const)
      : []),
    ...(photo.addedText ? (["photo_text"] as const) : []),
  ];
}
