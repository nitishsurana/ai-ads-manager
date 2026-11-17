import { FALLBACK_FAMILY } from "@/lib/fonts";
import type { FontSet, Weight } from "./fonts";

// Width in pixels of one line of text.
export type Measure = (
  text: string,
  size: number,
  weight: Weight,
  tracking?: number,
) => number;

// The faces to try for a family, in order: the brand font, then the fallback's latin and latin-ext faces.
function chain(faces: FontSet, family: string, weight: Weight) {
  const order = [family, FALLBACK_FAMILY];
  return faces
    .filter((face) => face.weight === weight && order.includes(face.family))
    .sort(
      (a, b) =>
        order.indexOf(a.family) - order.indexOf(b.family) ||
        a.subset.localeCompare(b.subset),
    );
}

const codePoints = (text: string) =>
  Array.from(text, (char) => char.codePointAt(0) ?? 0);

// Code points no face in the chain has a glyph for; the text can't be drawn with them.
export function missingGlyphs(faces: FontSet, family: string, text: string) {
  const available = chain(faces, family, 400);
  return Array.from(new Set(codePoints(text))).filter(
    (cp) =>
      cp > 32 && !available.some((face) => face.font.hasGlyphForCodePoint(cp)),
  );
}

// Whether the brand font alone covers the text, so the fallback is not needed.
export function coveredBy(faces: FontSet, family: string, text: string) {
  const own = faces.find((face) => face.family === family);
  return (
    own !== undefined &&
    codePoints(text).every(
      (cp) => cp <= 32 || own.font.hasGlyphForCodePoint(cp),
    )
  );
}

// Advance widths from the font files, kerning included, with each run of characters shaped by the first face that has its glyphs.
export function createMeasure(faces: FontSet, family: string): Measure {
  return (text, size, weight, tracking = 0) => {
    const candidates = chain(faces, family, weight);
    const runs: { face: (typeof candidates)[number]; text: string }[] = [];
    for (const char of Array.from(text)) {
      const cp = char.codePointAt(0) ?? 0;
      const face =
        candidates.find((candidate) =>
          candidate.font.hasGlyphForCodePoint(cp),
        ) ?? candidates[0];
      if (!face) throw new Error(`measure: no font loaded for ${family}`);
      const last = runs.at(-1);
      if (last?.face === face) last.text += char;
      else runs.push({ face, text: char });
    }
    const width = runs.reduce((sum, run) => {
      const { font } = run.face;
      return (
        sum + (font.layout(run.text).advanceWidth * size) / font.unitsPerEm
      );
    }, 0);
    return width + tracking * size * Array.from(text).length;
  };
}
