import { fromHex } from "./colour";
import type { LoadedLogo } from "./load";
import {
  dominantColours,
  hasNearWhiteBox,
  inkMask,
  removeNearWhiteBox,
  toPng,
  trimToArtwork,
  type Rgba,
} from "./pixels";
import type { LogoColourClass } from "./types";

const MAX_COLOURS = 4;

export type CleanedLogo = {
  rgba: Rgba;
  png: Buffer;
  transparent: boolean;
  colourClass: LogoColourClass;
  colours: string[];
};

// A flat near-white box goes (flood fill from the edges, so enclosed white stays), then the padding. A box in any other colour is part of the artwork and stays.
export async function cleanLogo(
  loaded: LoadedLogo,
): Promise<CleanedLogo | null> {
  const { raster } = loaded;
  const boxed = hasNearWhiteBox(raster);
  const unboxed = boxed ? removeNearWhiteBox(raster) : raster;

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
  };
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
