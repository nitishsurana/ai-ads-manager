import * as cheerio from "cheerio";
import { parseColour, toHex } from "./colour";
import type { LogoColourClass } from "./types";

const SHAPES = "path, rect, circle, ellipse, polygon, polyline, line, text";
const PAINT_ATTRS = ["fill", "stroke", "stop-color"];
const PAINT_STYLE = /(?:^|[;{\s])(?:fill|stroke|stop-color)\s*:\s*([^;}!]+)/gi;
const RASTER_HREF =
  /^(?:data:image\/(?:png|jpe?g|webp|gif);base64,|https?:\/\/|\/\/)/i;
// A reference that leaves the document: @import, or url() to anything but a #fragment or a data: URL.
const OUTSIDE_URL = /url\(\s*["']?(?!#|data:)/i;
const IMPORT_RULE = /@import[^;{}]*;?/gi;
const OUTSIDE_DECLARATION =
  /[\w-]+\s*:[^;{}]*url\(\s*["']?(?!#|data:)[^;{}]*;?/gi;
const SAFE_HREF = /^(?:#|data:image\/(?:png|jpe?g|webp|gif)[;,])/i;
const SVG_MIME = /svg/i;

export function looksLikeSvg(bytes: Buffer, contentType: string | undefined) {
  if (contentType && SVG_MIME.test(contentType)) return true;
  return /<svg[\s>]/i.test(bytes.subarray(0, 2048).toString("utf8"));
}

// Removes only the @import rules and the declarations whose url() points outside, so class-styled colours survive.
function withoutOutsideCss(css: string) {
  return css.replace(IMPORT_RULE, "").replace(OUTSIDE_DECLARATION, "");
}

// Defence in depth. The real offline guarantee is that librsvg rendering from a buffer fetches nothing; this also drops references that would reach outside the file if that ever changed: @import rules, declarations with url() to anything but a #fragment or data: URL, links that are not a #fragment or an inline raster, and the DOCTYPE with its entities. SVGs are rasterised and discarded, never stored.
export function stripExternalReferences(markup: string): string | null {
  const $ = cheerio.load(markup, { xml: true });
  $("*")
    .add($.root())
    .contents()
    .filter((_, node) => node.type === "directive")
    .remove();
  $("style").each((_, el) => {
    $(el).text(withoutOutsideCss($(el).text()));
  });
  $("*").each((_, el) => {
    for (const [name, raw] of Object.entries($(el).attr() ?? {})) {
      const value = raw.trim();
      const isLink = name === "href" || name.endsWith(":href");
      if (isLink && !SAFE_HREF.test(value)) {
        $(el).removeAttr(name);
      } else if (name === "style") {
        $(el).attr("style", withoutOutsideCss(value));
      } else if (OUTSIDE_URL.test(value)) {
        $(el).removeAttr(name);
      }
    }
  });
  const svg = $("svg").first();
  return svg.length > 0 ? $.xml(svg) : null;
}

// Some "SVG" logos are a raster image inside an svg element (a Canva export, for example); the raster is what should be used. Read from the raw markup, before the external references are stripped.
export function embeddedRaster(markup: string): string | null {
  const $ = cheerio.load(markup, { xml: true });
  if ($(SHAPES).length > 0) return null;
  const image = $("image").first();
  const href = image.attr("href") ?? image.attr("xlink:href") ?? "";
  return RASTER_HREF.test(href) ? href : null;
}

// Images, masks and filters decide the colours in some exports (Canva), so the rendered picture has to be read instead.
export function paintsByMarkup(markup: string) {
  return !/<(image|mask|filter)[\s>]/i.test(markup);
}

export function svgColourClass(markup: string): {
  colourClass: LogoColourClass;
  colours: string[];
} {
  const $ = cheerio.load(markup, { xml: true });
  const values: string[] = [];
  $("*").each((_, el) => {
    if ($(el).closest("clipPath, mask").length > 0) return;
    for (const attr of PAINT_ATTRS) {
      const value = $(el).attr(attr);
      if (value) values.push(value);
    }
    for (const match of ($(el).attr("style") ?? "").matchAll(PAINT_STYLE)) {
      values.push(match[1] ?? "");
    }
  });
  for (const style of $("style").toArray()) {
    for (const match of $(style).text().matchAll(PAINT_STYLE)) {
      values.push(match[1] ?? "");
    }
  }

  const colours = new Set<string>();
  let current = false;
  for (const raw of values) {
    const value = raw.trim().toLowerCase();
    if (value === "currentcolor") current = true;
    else if (
      /^(none|transparent|inherit|initial)$/.test(value) ||
      value.startsWith("url(") ||
      value === ""
    )
      continue;
    else {
      const rgb = parseColour(value);
      colours.add(rgb ? toHex(rgb) : value);
    }
  }
  const count = colours.size + (current ? 1 : 0);
  // No explicit paint at all means the page's CSS or the default black decides, so it takes any colour.
  const colourClass: LogoColourClass =
    count >= 2
      ? "multi_colour"
      : count === 0 || current
        ? "current_colour"
        : "one_colour";
  return { colourClass, colours: [...colours] };
}
