import sharp from "sharp";
import {
  coveredBy,
  createMeasure,
  decodePixels,
  fontVersions,
  missingGlyphs,
  planLayout,
  previewOf,
  renderCreative,
  sampleBackdrop,
  type FontSet,
  type Layout,
  type LayoutInput,
} from "@/lib/render";
import { parseColour } from "@/lib/intake";
import type { RoundInputs } from "../inputs";
import type { Candidate } from "../types";
import {
  badgeSpec,
  brandColours,
  brandInk,
  parseColours,
  wordmarkName,
} from "./inputs";

export type Logo = { png: Buffer; aspect: number };

export async function readLogo(
  png: Buffer,
  size: { width: number | null; height: number | null },
): Promise<Logo> {
  const meta = size.width && size.height ? size : await sharp(png).metadata();
  if (!meta.width || !meta.height)
    throw new Error("logo: the image has no size");
  return { png, aspect: meta.width / meta.height };
}

function logoSpec(inputs: RoundInputs, logo: Logo | null): LayoutInput["logo"] {
  const source = inputs.logo;
  if (!source) return null;
  const wordmark = wordmarkName(inputs);
  const header = source.headerBackground
    ? parseColour(source.headerBackground)
    : null;
  return {
    kind: logo ? "image" : "wordmark",
    aspect: logo?.aspect ?? 1,
    colourClass: source.colourClass,
    colours: parseColours(source.colours),
    headerBackground: header,
    wordmark,
    brandInk: brandInk(inputs),
  };
}

// The layout for one candidate, planned from the background's pixels.
export async function planCreative(
  candidate: Candidate,
  background: Buffer,
  context: {
    inputs: RoundInputs;
    fonts: FontSet;
    logo: Logo | null;
    label: string;
    // An edit keeps the stored creative's setting; a new candidate keeps the text clear wherever the product's box can be trusted.
    keepClear?: boolean;
  },
): Promise<Layout> {
  const { inputs, fonts, logo, label } = context;
  const { copy, product } = candidate;
  const scene = candidate.background;
  if (!copy) throw new Error(`${label}: candidate has no copy`);

  const pixels = await decodePixels(background);
  const face = (family: string) => ({
    family,
    measure: createMeasure(fonts, family),
    needsFallback: (text: string) => !coveredBy(fonts, family, text),
    unsupported: (text: string) =>
      missingGlyphs(fonts, family, text).length > 0,
  });
  const layout = planLayout({
    copy,
    fonts: fontVersions(fonts),
    method: scene.method,
    product,
    keepClear:
      context.keepClear ??
      (scene.method !== "photo" || scene.isolated === true),
    badge: badgeSpec(candidate, inputs),
    offerFactId: candidate.offerFactId,
    heading: face(inputs.brandKit.fonts.heading.family),
    body: face(inputs.brandKit.fonts.body.family),
    ...brandColours(inputs),
    logo: logoSpec(inputs, logo),
    sample: (box, scrim) => sampleBackdrop(pixels, box, scrim),
  });
  for (const { element, reason } of layout.dropped) {
    console.warn(`${label}: ${element}: ${reason}`);
  }
  return layout;
}

// One candidate: plan, then draw from the plan. The preview is the full-size creative as a JPEG.
export async function composeCandidate(
  candidate: Candidate,
  background: Buffer,
  context: {
    inputs: RoundInputs;
    fonts: FontSet;
    logo: Logo | null;
    label: string;
  },
) {
  const layout = await planCreative(candidate, background, context);
  const { png, problems } = await renderCreative({
    background,
    layout,
    fonts: context.fonts,
    logo: context.logo?.png ?? null,
  });
  for (const problem of problems) console.warn(`${context.label}: ${problem}`);
  return { layout, preview: await previewOf(png) };
}
