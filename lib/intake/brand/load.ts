import sharp from "sharp";
import { sha256, SnapshotError } from "@/lib/providers/snapshot";
import { fetchFirst } from "./fetch";
import type { LogoRef } from "./header-logo";
import { logSwallowed } from "./log";
import { decodeRgba, transparentShare, type Rgba } from "./pixels";
import {
  embeddedRaster,
  looksLikeSvg,
  paintsByMarkup,
  stripExternalReferences,
  svgColourClass,
} from "./svg";
import { logoUrls } from "./urls";
import type { LogoColourClass } from "./types";
import type { Http } from "@/lib/providers/http";

const SVG_RENDER_SIDE = 1200;
const MAX_DENSITY = 7200;
const MAX_SVG_CHARS = 2_000_000;
// Part of the model replay key: change the decode or cleanup steps and recorded logo answers stop matching.
export const LOAD_VERSION = "decode-2048-svg-1200-ink-v4";

export type LoadedLogo = {
  // Hash of the original file (or the svg markup with external references stripped): the model replay key.
  sha256: string;
  sourceUrl: string | null;
  alt: string | null;
  raster: Rgba;
  // Colour class and colours read from the svg source, which the rendered picture cannot tell (currentColor); null for rasters and for svgs whose picture decides the colours.
  svgClass: { colourClass: LogoColourClass; colours: string[] } | null;
  // The rendered file had transparency, judged before any cleanup (an svg with a full-bleed background does not).
  transparentSource: boolean;
};

// Renders so the long side comes out at SVG_RENDER_SIDE: a 24x24 viewBox is scaled up, a huge one down.
async function renderSvg(markup: string) {
  const { width, height } = await sharp(Buffer.from(markup)).metadata();
  const side = Math.max(width ?? 0, height ?? 0) || 100;
  const density = Math.min(
    MAX_DENSITY,
    Math.max(1, Math.round((72 * SVG_RENDER_SIDE) / side)),
  );
  return decodeRgba(Buffer.from(markup), { density });
}

function dataUri(href: string): Buffer | null {
  const match = /^data:[^;]+;base64,([\s\S]*)$/.exec(href);
  return match ? Buffer.from(match[1] ?? "", "base64") : null;
}

export async function loadLogo(
  ref: LogoRef,
  base: string,
  label: string,
  deps: { http: Http },
): Promise<LoadedLogo | null> {
  let sourceUrl: string | null = null;
  let bytes: Buffer;
  let contentType: string | undefined;
  if (ref.kind === "svg") {
    bytes = Buffer.from(ref.markup);
  } else {
    const urls = logoUrls(ref.href, base);
    const fetched = await fetchFirst(urls, label, deps);
    if (!fetched) return null;
    ({ bytes, contentType } = fetched);
    sourceUrl = urls[0] ?? null;
  }
  const alt = ref.alt;

  try {
    if (looksLikeSvg(bytes, contentType)) {
      const raw = bytes.toString("utf8");
      if (raw.length > MAX_SVG_CHARS) throw new Error("svg is too large");
      const wrapped = embeddedRaster(raw);
      if (!wrapped) {
        // Rendering stays offline: the markup is rasterised and discarded, never stored.
        const markup = stripExternalReferences(raw);
        if (!markup) throw new Error("no svg element");
        const raster = await renderSvg(markup);
        return {
          sha256: sha256(Buffer.from(markup)),
          sourceUrl,
          alt,
          raster,
          svgClass: paintsByMarkup(markup) ? svgColourClass(markup) : null,
          transparentSource: transparentShare(raster) >= 0.01,
        };
      }
      // The svg is only a frame around a picture: the picture is the logo, and no svg is kept.
      const inner = dataUri(wrapped);
      const urls = inner ? [] : logoUrls(wrapped, sourceUrl ?? base);
      const fetched = inner
        ? { bytes: inner, contentType: undefined }
        : await fetchFirst(urls, label, deps);
      if (!fetched) return null;
      if (looksLikeSvg(fetched.bytes, fetched.contentType)) {
        logSwallowed(label, "wrapped image", "the inner image is an svg");
        return null;
      }
      bytes = fetched.bytes;
      sourceUrl = urls[0] ?? null;
    }
    if ((await sharp(bytes).metadata()).format === "svg") {
      logSwallowed(label, "decode", "the image is an svg in disguise");
      return null;
    }
    const raster = await decodeRgba(bytes);
    return {
      sha256: sha256(bytes),
      sourceUrl,
      alt,
      raster,
      svgClass: null,
      transparentSource: transparentShare(raster) >= 0.01,
    };
  } catch (error) {
    if (error instanceof SnapshotError) throw error;
    logSwallowed(label, "decode", error);
    return null;
  }
}
