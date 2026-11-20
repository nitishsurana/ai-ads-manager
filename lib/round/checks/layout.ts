import {
  CTA_MIN_CONTRAST,
  CTA_MIN_DELTA_E,
  LOGO_MIN_CONTRAST,
  TEXT_MIN_CONTRAST,
} from "@/lib/config";
import {
  AD_NETWORK_COLOURS,
  insideLogoArea,
  insideSafe,
  LOGO_LIMITS,
  withSymbol,
} from "@/lib/render";
import type { Box, Layout } from "@/lib/render";
import { overlaps } from "@/lib/render/canvas";
import { contrast, deltaE, fromHex } from "@/lib/render/colour";
import { brandColours, wordmarkName } from "../compose/inputs";
import { COPY_WORDS, CTA_WORDS, HEADLINE_CHARS, HEADLINE_WORDS } from "../copy";
import { squash, wordCount as words } from "../copy/limits";
import type { RoundInputs } from "../inputs";
import type { Candidate } from "../types";

type Subject = Pick<Candidate, "supportingElement" | "offerFactId" | "copy">;

function copyProblems(copy: NonNullable<Candidate["copy"]>) {
  const problems: string[] = [];
  const eyebrow = copy.eyebrow ? words(copy.eyebrow) : 0;
  if (
    words(copy.headline) > HEADLINE_WORDS ||
    copy.headline.length > HEADLINE_CHARS
  ) {
    problems.push(
      `words: the headline passes ${HEADLINE_WORDS} words / ${HEADLINE_CHARS} characters`,
    );
  }
  if (eyebrow + words(copy.headline) > COPY_WORDS) {
    problems.push(`words: the eyebrow and headline pass ${COPY_WORDS} words`);
  }
  if (words(copy.cta) > CTA_WORDS) {
    problems.push(`words: the CTA passes ${CTA_WORDS} words`);
  }
  return problems;
}

// What the layout draws is what the copy says.
function drawnProblems(layout: Layout, copy: NonNullable<Candidate["copy"]>) {
  const problems: string[] = [];
  const same = (part: string, lines: string[], text: string) => {
    if (squash(lines.join(" ")) !== squash(text)) {
      problems.push(`text: the ${part} drawn is not the copy`);
    }
  };
  same("headline", layout.headline.lines, copy.headline);
  same("CTA", layout.cta.lines, copy.cta);
  if (copy.eyebrow && !layout.eyebrow)
    problems.push("text: the eyebrow is not drawn");
  if (layout.eyebrow) same("eyebrow", layout.eyebrow.lines, copy.eyebrow ?? "");
  return problems;
}

function glyphProblems(
  layout: Layout,
  missing: (family: string, text: string) => number[],
) {
  const texts: [string, string, string][] = [
    ["headline", layout.headline.font.family, layout.headline.lines.join(" ")],
    ["CTA", layout.cta.font.family, layout.cta.lines.join(" ")],
    ...(layout.eyebrow
      ? [
          [
            "eyebrow",
            layout.eyebrow.font.family,
            layout.eyebrow.lines.join(" "),
          ] as [string, string, string],
        ]
      : []),
    ...(layout.logo?.wordmark
      ? [
          [
            "wordmark",
            layout.logo.wordmark.font.family,
            layout.logo.wordmark.text,
          ] as [string, string, string],
        ]
      : []),
    ...(layout.badge
      ? [
          [
            "badge",
            layout.badge.font.family,
            layout.badge.rows.map((r) => r.text).join(" "),
          ] as [string, string, string],
        ]
      : []),
  ];
  return texts.flatMap(([part, family, text]) => {
    const absent = missing(family, text);
    return absent.length > 0
      ? [
          `glyphs: no font has U+${absent[0]?.toString(16).toUpperCase()} of the ${part}`,
        ]
      : [];
  });
}

function marginProblems(layout: Layout) {
  const boxes: [string, Box][] = [
    ["headline", layout.headline.box],
    ["CTA", layout.cta.box],
    ...(layout.eyebrow
      ? [["eyebrow", layout.eyebrow.box] as [string, Box]]
      : []),
    ...(layout.badge ? [["badge", layout.badge.box] as [string, Box]] : []),
  ];
  const problems = boxes
    .filter(([, box]) => !insideSafe(box))
    .map(([name]) => `margins: the ${name} leaves the safe margins`);
  const { logo } = layout;
  if (
    logo &&
    !insideLogoArea(logo.panel?.box ?? logo.box, layout.logoGeometry ?? 1)
  ) {
    problems.push("margins: the logo leaves the safe margins");
  }
  return problems;
}

function colourProblems(layout: Layout, inputs: RoundInputs) {
  const problems: string[] = [];
  if (layout.headline.contrast < TEXT_MIN_CONTRAST) {
    problems.push(
      `contrast: the headline's is ${layout.headline.contrast.toFixed(2)}, under ${TEXT_MIN_CONTRAST}`,
    );
  }
  const accent = fromHex(layout.cta.background);
  if (contrast(fromHex(layout.cta.colour), accent) < CTA_MIN_CONTRAST) {
    problems.push(`contrast: the CTA label is under ${CTA_MIN_CONTRAST}`);
  }
  const avoid = [
    ...(layout.cta.mode === "brand" ? [] : brandColours(inputs).brandColours),
    ...AD_NETWORK_COLOURS,
  ];
  if (avoid.some((colour) => deltaE(accent, colour) < CTA_MIN_DELTA_E)) {
    problems.push(
      `cta colour: within ΔE ${CTA_MIN_DELTA_E} of a brand or ad-network colour`,
    );
  }
  if (
    layout.badge &&
    contrast(fromHex(layout.badge.colour), fromHex(layout.badge.background)) <
      TEXT_MIN_CONTRAST
  ) {
    problems.push(`contrast: the badge text is under ${TEXT_MIN_CONTRAST}`);
  }
  return problems;
}

function logoProblems(layout: Layout, inputs: RoundInputs) {
  const { logo } = layout;
  if (!logo) {
    const dropped = layout.dropped.some((d) => d.element === "logo");
    return inputs.logo && !dropped
      ? ["logo: missing, and not dropped by the fallback chain"]
      : [];
  }
  const problems: string[] = [];
  if (!inputs.logo) problems.push("logo: drawn although none was found");
  if (inputs.logo?.source === "wordmark") {
    const name = wordmarkName(inputs);
    if (logo.kind !== "wordmark" || logo.wordmark?.text !== name) {
      problems.push("logo: the brand name is not drawn as a wordmark");
    }
  }
  const limits = LOGO_LIMITS[layout.logoGeometry ?? 1];
  if (logo.box.w > limits.width || logo.box.h > limits.height) {
    problems.push("logo: over the size cap");
  }
  if (logo.decision === "badge" && !inputs.logo?.badge) {
    problems.push("logo: drawn as a badge although it is not one");
  }
  const moved = logo.corner !== "bottom_right";
  if (
    moved &&
    !(
      logo.decision === "calmer_corner" &&
      inputs.logo?.colourClass === "multi_colour"
    )
  ) {
    problems.push(
      `logo: in the ${logo.corner} corner without a contrast reason`,
    );
  }
  const exempt =
    logo.decision === "badge" ||
    (logo.decision === "panel" && inputs.logo?.colourClass === "multi_colour");
  if (!exempt && logo.contrast < LOGO_MIN_CONTRAST) {
    problems.push(
      `contrast: the logo's is ${logo.contrast.toFixed(2)}, under ${LOGO_MIN_CONTRAST}`,
    );
  }
  return problems;
}

// The badge shows what step 1 confirmed, for the element the plan gave this candidate.
function elementProblems(
  layout: Layout,
  subject: Subject,
  inputs: RoundInputs,
) {
  const { badge } = layout;
  const { values } = inputs;
  const element = subject.supportingElement;
  const problems: string[] = [];
  if (layout.offerFactId !== subject.offerFactId)
    problems.push("element: the layout lost the offer fact id");
  if (layout.dropped.some((d) => d.element === "badge"))
    problems.push("element: the badge was dropped");
  if (!element)
    return badge
      ? [...problems, "element: a badge without a supporting element"]
      : problems;
  if (!badge) return [...problems, `element: no ${element} badge is drawn`];
  if (badge.kind !== element)
    return [
      ...problems,
      `element: a ${badge.kind} badge for a ${element} candidate`,
    ];

  const rows = badge.rows;
  const want = (ok: boolean, what: string) => {
    if (!ok) problems.push(`element: the ${what} is not what step 1 confirmed`);
  };
  if (element === "price" && values.price) {
    want(rows[0]?.text === withSymbol(values.price, values.currency), "price");
    const was = rows.find((row) => row.strike)?.text;
    want(
      was ===
        (values.wasPrice
          ? withSymbol(values.wasPrice, values.currency)
          : undefined),
      "was price",
    );
  } else if (element === "rating" && values.rating) {
    want(
      rows[0]?.text === values.rating.value.toFixed(1) &&
        rows[0]?.star === true,
      "rating",
    );
    want(
      rows[1]?.text ===
        `${values.rating.count.toLocaleString("en-US")} reviews`,
      "review count",
    );
  } else if (element === "offer") {
    const fact = inputs.facts.find((f) => f.id === subject.offerFactId);
    want(
      fact !== undefined && rows.map((row) => row.text).join(" ") === fact.text,
      "offer",
    );
  } else {
    problems.push(`element: ${element} is not confirmed in step 1`);
  }
  return problems;
}

export const COVERS_PRODUCT =
  "text: the eyebrow, headline or CTA covers the product";

function coverProblems(layout: Layout) {
  const { product } = layout;
  if (!layout.keepClear || !product) return [];
  const texts = [layout.eyebrow, layout.headline, layout.cta];
  return texts.some((text) => text && overlaps(text.box, product))
    ? [COVERS_PRODUCT]
    : [];
}

// Everything Layer 1 can say from the candidate and its stored layout alone.
export function layoutProblems(
  layout: Layout,
  subject: Subject,
  inputs: RoundInputs,
  missingGlyphs: (family: string, text: string) => number[],
) {
  const { copy } = subject;
  if (!copy) return ["copy: the candidate has none"];
  return [
    ...copyProblems(copy),
    ...drawnProblems(layout, copy),
    ...glyphProblems(layout, missingGlyphs),
    ...marginProblems(layout),
    ...coverProblems(layout),
    ...colourProblems(layout, inputs),
    ...logoProblems(layout, inputs),
    ...elementProblems(layout, subject, inputs),
    ...layout.dropped
      .filter((d) => d.element === "headline" || d.element === "cta")
      .map((d) => `layout: the ${d.element} does not fit`),
  ];
}
