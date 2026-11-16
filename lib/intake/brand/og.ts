import type { CheerioAPI } from "cheerio";
import { dominantColours, hasFlatBackground, type Rgba } from "./pixels";

const MAX_LOGO_COLOURS = 4;

export function ogImageHref($: CheerioAPI) {
  return (
    $('meta[property="og:image:secure_url"]').attr("content") ??
    $('meta[property="og:image"]').attr("content") ??
    null
  );
}

// Most share images are banners or photos: only one whose file name says "logo", with few colours on a flat or transparent background, is tried.
export function namesALogo(href: string) {
  const file = (URL.parse(href)?.pathname ?? href).split("/").at(-1) ?? "";
  return /logo/i.test(decodeURIComponent(file));
}

export function looksLikeLogo(raster: Rgba) {
  return (
    dominantColours(raster).length <= MAX_LOGO_COLOURS &&
    hasFlatBackground(raster)
  );
}
