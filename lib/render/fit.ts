import type { Weight } from "./fonts";
import type { Measure } from "./measure";

export type FitOptions = {
  maxWidth: number;
  maxLines: number;
  // Largest first, in pixels.
  sizes: readonly number[];
  weight: Weight;
  tracking?: number;
};

export type Fit = {
  size: number;
  lines: string[];
  // Whether every line fits the width and the line count at this size.
  fits: boolean;
};

// Greedy wrap by words. A word wider than the width stands alone on its line.
export function wrapWords(
  text: string,
  width: (line: string) => number,
  maxWidth: number,
) {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && width(`${last} ${word}`) <= maxWidth) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

// The narrowest wrap with the same number of lines, so a short last line doesn't hang under a long first one.
function balance(
  text: string,
  width: (line: string) => number,
  maxWidth: number,
  count: number,
) {
  let [low, high] = [0, maxWidth];
  let best = wrapWords(text, width, maxWidth);
  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2;
    const lines = wrapWords(text, width, mid);
    if (
      lines.length <= count &&
      lines.every((line) => width(line) <= maxWidth)
    ) {
      best = lines;
      high = mid;
    } else {
      low = mid;
    }
  }
  return best;
}

// The largest size where the text fits in at most maxLines lines. The last size is returned, flagged, when none fits.
export function fitText(
  text: string,
  measure: Measure,
  options: FitOptions,
): Fit {
  const { maxWidth, maxLines, sizes, weight, tracking } = options;
  let lines: string[] = [];
  let size = sizes.at(-1) ?? 0;
  for (const candidate of sizes) {
    const width = (line: string) => measure(line, candidate, weight, tracking);
    lines = wrapWords(text, width, maxWidth);
    size = candidate;
    if (
      lines.length <= maxLines &&
      lines.every((line) => width(line) <= maxWidth)
    ) {
      return {
        size,
        lines: balance(text, width, maxWidth, lines.length),
        fits: true,
      };
    }
  }
  return { size, lines, fits: false };
}

export function sizeRange(max: number, min: number, step: number) {
  const sizes: number[] = [];
  for (let size = Math.round(max); size >= min; size -= step) sizes.push(size);
  return sizes;
}

export const lineWidth = (
  lines: string[],
  measure: Measure,
  size: number,
  weight: Weight,
  tracking?: number,
) => Math.max(0, ...lines.map((line) => measure(line, size, weight, tracking)));
