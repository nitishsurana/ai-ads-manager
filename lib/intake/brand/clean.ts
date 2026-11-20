import { fromHex } from "./colour";
import type { LoadedLogo } from "./load";
import {
  badgeShare,
  dominantColours,
  featherEdge,
  hasNearWhiteBox,
  inkMask,
  removeNearWhiteBox,
  toPng,
  trimToArtwork,
  type Rgba,
} from "./pixels";
import type { LogoColourClass } from "./types";

const MAX_COLOURS = 4;
// Measured on the recorded logos: the jam-label badge is 0.455, the fullest wordmark or ring emblem 0.375.
const BADGE_SHARE = 0.42;

export type CleanedLogo = {
  rgba: Rgba;
  png: Buffer;
  transparent: boolean;
  colourClass: LogoColourClass;
  colours: string[];
  // A disc or sticker with its own field: drawn as it is, white inside included.
  badge: boolean;
};

// A flat near-white box goes (flood fill from the edges, so enclosed white stays), then the padding. A box in any other colour is part of the artwork and stays. Artwork that fills most of its own box in two or more colours, white counted, is a badge and keeps its white as ink.
export async function cleanLogo(
  loaded: LoadedLogo,
): Promise<CleanedLogo | null> {
  const { raster } = loaded;
  const boxed = hasNearWhiteBox(raster);
  const unboxed = boxed ? removeNearWhiteBox(raster) : raster;

  const whole = trimToArtwork(unboxed);
  if (!whole) return null;
  const badgeColours = badgeColoursOf(whole, loaded);
  if (badgeColours) {
    const rgba = boxed ? featherEdge(whole) : whole;
    return {
      rgba,
      png: await toPng(rgba),
      transparent: loaded.transparentSource || boxed,
      colourClass: "multi_colour",
      colours: badgeColours.slice(0, MAX_COLOURS),
      badge: true,
    };
  }

  const { colourClass, colours } =
    loaded.svgClass ?? classifyRaster(unboxed, boxed);
  // One ink on a removed box: fade the edges and open the counters. Light ink would leave too little contrast to measure against.
  const ink = colours[0] ? fromHex(colours[0]) : null;
  const inked =
    boxed && colourClass === "one_colour" && ink && Math.min(...ink) < 200
      ? inkMask(unboxed, ink)
      : unboxed;
  const rgba = trimToArtwork(inked);
  if (!rgba) return null;
  return {
    rgba,
    png: await toPng(rgba),
    transparent: loaded.transparentSource || boxed,
    colourClass,
    colours: colours.slice(0, MAX_COLOURS),
    badge: false,
  };
}

// The colours of a badge, white included; null when the logo is not one. A currentColor or single-fill svg is never a badge.
function badgeColoursOf(whole: Rgba, loaded: LoadedLogo) {
  if (loaded.svgClass && loaded.svgClass.colourClass !== "multi_colour") {
    return null;
  }
  if (badgeShare(whole) < BADGE_SHARE) return null;
  const colours = dominantColours(whole).map((c) => c.hex);
  return colours.length >= 2 ? colours : null;
}

// After a box is removed, the white left inside letters and rings is page, not ink.
function classifyRaster(rgba: Rgba, boxRemoved: boolean) {
  const colours = dominantColours(rgba, { ignoreNearWhite: boxRemoved }).map(
    (c) => c.hex,
  );
  const colourClass: LogoColourClass =
    colours.length >= 2 ? "multi_colour" : "one_colour";
  return { colourClass, colours };
}
