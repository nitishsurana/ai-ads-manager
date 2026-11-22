import sharp from "sharp";
import { scrimSvg } from "@/lib/render";
import type { Layout } from "@/lib/render";
import {
  TEXT_MIN_CONTRAST,
  CTA_MIN_CONTRAST,
  CTA_MIN_DELTA_E,
} from "@/lib/config";
import { parseColour } from "@/lib/intake";
import type { RoundInputs } from "@/lib/round/inputs";
import type { Candidate } from "@/lib/round/types";
import { AD_NETWORK_COLOURS } from "@/lib/render/ad-network";
import { contrast, deltaE, fromHex } from "@/lib/render/colour";
import {
  CANVAS,
  insideLogoArea,
  insideSafe,
  layoutSchema,
  LOGO_LIMITS,
  type Box,
} from "@/lib/render";
import { overlaps } from "@/lib/render/canvas";
import { brandColours } from "@/lib/round/compose/inputs";

const OFFER_FACT = (inputs: RoundInputs, id: string | null) =>
  inputs.facts.find((fact) => fact.id === id)?.text;

export type Rendered = {
  candidate: Candidate;
  preview: Buffer;
  background: Buffer;
  // What Layer 1 said about the product when it checked the stored creative.
  placement?: string[];
};

// Geometry and colour rules every rendered creative must meet, checked from the stored layout and the files. Written from the spec, not from what the renderer happened to produce.
export async function renderProblems(
  inputs: RoundInputs,
  { candidate, preview, background, placement = [] }: Rendered,
) {
  const problems: string[] = placement.map(
    (problem) => `candidate ${candidate.index}: ${problem}`,
  );
  const label = `candidate ${candidate.index}`;
  const parsed = layoutSchema.safeParse(candidate.layout);
  if (!parsed.success) return [`${label}: layout fails its schema`];
  const layout = parsed.data;
  const check = (ok: boolean, message: string) => {
    if (!ok) problems.push(`${label}: ${message}`);
  };

  const boxes: [string, Box][] = [
    ["headline", layout.headline.box],
    ["cta", layout.cta.box],
    ...(layout.eyebrow
      ? [["eyebrow", layout.eyebrow.box] as [string, Box]]
      : []),
    ...(layout.badge ? [["badge", layout.badge.box] as [string, Box]] : []),
  ];
  const geometry = layout.logoGeometry ?? 1;
  const logoBox = layout.logo
    ? (["logo", layout.logo.panel?.box ?? layout.logo.box] as [string, Box])
    : null;
  for (const [name, box] of boxes) {
    check(insideSafe(box), `${name} box leaves the safe margins`);
  }
  if (logoBox) {
    check(
      insideLogoArea(logoBox[1], geometry),
      "logo box leaves the safe margins",
    );
  }
  const texts = boxes.filter(([name]) => name !== "badge");
  for (const [name, box] of [...boxes, ...(logoBox ? [logoBox] : [])]) {
    for (const [other, against] of texts) {
      if (
        name !== other &&
        overlaps(box, against) &&
        name !== "cta" &&
        other !== "cta"
      ) {
        check(false, `${name} covers ${other}`);
      }
    }
  }
  if (layout.keepClear && layout.product) {
    for (const [name, box] of texts) {
      check(!overlaps(box, layout.product), `${name} covers the product`);
    }
  }
  check(layout.headline.lines.length <= 3, "headline has more than 3 lines");
  check(
    !layout.dropped.some(
      (d) => d.element === "headline" || d.element === "cta",
    ),
    "headline or CTA does not fit",
  );

  const accent = fromHex(layout.cta.background);
  check(
    contrast(fromHex(layout.cta.colour), accent) >= CTA_MIN_CONTRAST,
    "CTA label contrast is under 4.5",
  );
  const avoid = [
    ...(layout.cta.mode === "brand" ? [] : brandColours(inputs).brandColours),
    ...AD_NETWORK_COLOURS,
  ];
  check(
    avoid.every((colour) => deltaE(accent, colour) >= CTA_MIN_DELTA_E),
    "CTA colour is within ΔE 20 of a brand or ad-network colour",
  );

  if (layout.logo) {
    const limits = LOGO_LIMITS[geometry];
    check(layout.logo.box.w <= limits.width, "logo is over its width cap");
    check(layout.logo.box.h <= limits.height, "logo is over its height cap");
    const exempt =
      layout.logo.decision === "badge" ||
      (layout.logo.decision === "panel" &&
        inputs.logo?.colourClass === "multi_colour" &&
        layout.logoRule !== 2);
    check(exempt || layout.logo.contrast >= 3, "logo contrast is under 3:1");
  }
  check(
    (layout.badge !== null) === (candidate.supportingElement !== null),
    "badge presence does not match the supporting element",
  );
  if (layout.badge) {
    check(
      layout.badge.kind === candidate.supportingElement,
      "wrong badge kind",
    );
    if (layout.badge.kind === "offer") {
      const text = layout.badge.rows.map((row) => row.text).join(" ");
      check(
        text === OFFER_FACT(inputs, candidate.offerFactId),
        "offer text is not word for word",
      );
      check(text.length <= 40, "offer badge is over 40 characters");
    }
  }
  check(
    layout.offerFactId === candidate.offerFactId,
    "offerFactId is not in the layout",
  );
  if (layout.scrim) {
    check(
      layout.scrim.box.x === 0 &&
        layout.scrim.box.w === CANVAS.width &&
        (layout.scrim.edge === "top"
          ? layout.scrim.box.y === 0
          : layout.scrim.box.y + layout.scrim.box.h === CANVAS.height),
      "scrim is not full width from the canvas edge",
    );
  }
  check(
    layout.headline.contrast >= TEXT_MIN_CONTRAST,
    "stored headline contrast is under 4.5",
  );
  const seen = await headlineContrast(background, layout);
  check(
    seen >= TEXT_MIN_CONTRAST,
    `headline contrast on the pixels is ${seen.toFixed(2)}, under 4.5`,
  );

  const [bg, shown] = await Promise.all([
    sharp(background).metadata(),
    sharp(preview).metadata(),
  ]);
  check(
    bg.width === CANVAS.width && bg.height === CANVAS.height,
    "background is not 1080x1920",
  );
  check(shown.format === "jpeg", "preview is not a JPEG");
  check(
    shown.width !== undefined &&
      Math.abs((shown.height ?? 0) / shown.width - 16 / 9) < 0.01,
    "preview is not 9:16",
  );
  check(preview.length < 350_000, "preview is over 350 KB");
  check(
    parseColour(layout.headline.colour) !== null,
    "headline colour unreadable",
  );
  return problems;
}

const luminance = (r: number, g: number, b: number) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

// Headline (and eyebrow) ink against the pixels it sits on, with the scrim over them: the worse of the 2nd and 98th brightness percentiles over the whole text region, measured here from the stored background and layout, not from the planner.
export async function headlineContrast(background: Buffer, layout: Layout) {
  const base = layout.scrim
    ? await sharp(background)
        .composite([
          { input: scrimSvg(layout.scrim), left: 0, top: layout.scrim.box.y },
        ])
        .png()
        .toBuffer()
    : background;
  const top = layout.eyebrow?.box.y ?? layout.headline.box.y;
  const height = layout.headline.box.y + layout.headline.box.h - top;
  const { data } = await sharp(base)
    .extract({ left: 65, top, width: 950, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels: [number, number, number][] = [];
  for (let i = 0; i + 2 < data.length; i += 9) {
    pixels.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
  }
  pixels.sort((a, b) => luminance(...a) - luminance(...b));
  const at = (share: number) =>
    pixels[Math.min(pixels.length - 1, Math.floor(pixels.length * share))] ?? [
      0, 0, 0,
    ];
  const inks = [
    layout.headline.colour,
    layout.eyebrow?.colour ?? layout.headline.colour,
  ];
  return Math.min(
    ...inks.flatMap((ink) =>
      [at(0.02), at(0.98)].map((pixel) => contrast(fromHex(ink), pixel)),
    ),
  );
}
