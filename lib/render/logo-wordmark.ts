import { LOGO_MIN_CONTRAST } from "@/lib/config";
import {
  bestInk,
  DARK_INK,
  LIGHT_INK,
  toHex,
  worstContrast,
  type Rgb,
} from "./colour";
import { LOGO_LIMITS } from "./canvas";
import type { LogoLayout } from "./layout";
import type { LogoContext, LogoSpec } from "./logo";
import { cornerBox, round } from "./logo-box";
import { neutralPanel } from "./logo-panel";

// Below this height a wordmark is a smudge; it is dropped instead.
const WORDMARK_MIN_HEIGHT = 28;

type Wordmark = { layout: LogoLayout } | { reason: string };

// One line at the largest size that fits the cap; a name too wide for that at the smallest legible size is split into two balanced lines instead.
function fitWordmark(text: string, context: LogoContext) {
  const limits = LOGO_LIMITS[context.geometry];
  const lineHeight = (size: number) => Math.ceil(size * 1.2);
  const widest = (lines: string[], size: number) =>
    Math.ceil(
      Math.max(...lines.map((line) => context.measure(line, size, 700))),
    );
  const shrink = (lines: string[], from: number) => {
    let size = from;
    while (
      lineHeight(size - 2) >= WORDMARK_MIN_HEIGHT &&
      widest(lines, size) > limits.width
    ) {
      size -= 2;
    }
    return size;
  };
  let size = shrink([text], limits.wordmarkSize);
  if (widest([text], size) <= limits.width) {
    return { lines: [text], size, single: true };
  }

  const words = text.split(/\s+/);
  const splits = words
    .slice(1)
    .map((_, i) => [
      words.slice(0, i + 1).join(" "),
      words.slice(i + 1).join(" "),
    ]);
  const best = splits.reduce<string[] | null>(
    (pick, lines) =>
      !pick || widest(lines, size) < widest(pick, size) ? lines : pick,
    null,
  );
  if (!best) return { lines: [text], size, single: true };
  size = shrink(
    best,
    Math.min(limits.wordmarkSize, Math.floor(limits.height / 2.4)),
  );
  return { lines: best, size, single: false };
}

// A wordmark that lacks contrast on the scene goes on a neutral panel when the geometry has one; otherwise it is dropped.
export function wordmarkLayout(spec: LogoSpec, context: LogoContext): Wordmark {
  const text = spec.wordmark;
  if (!text) return { reason: "there is no wordmark text" };
  if (context.unsupported(text)) {
    return { reason: "no font has every glyph of the wordmark" };
  }
  const { geometry } = context;
  const { lines, size, single } = fitWordmark(text, context);
  const w = Math.ceil(
    Math.max(...lines.map((line) => context.measure(line, size, 700))),
  );
  const h = Math.ceil(size * 1.2) * lines.length;
  const cap = LOGO_LIMITS[geometry].width;
  if (w > cap) {
    return {
      reason: `the wordmark needs ${w} px, over the ${cap} px cap, at its smallest legible size${single ? " (a single word can't be split)" : ", even on two lines"}`,
    };
  }
  const box = cornerBox("bottom_right", w, h, geometry);
  const backdrop = context.sample(box);
  const own =
    spec.brandInk &&
    worstContrast(spec.brandInk, backdrop) >= LOGO_MIN_CONTRAST;
  const { ink, ratio } = own
    ? {
        ink: spec.brandInk as Rgb,
        ratio: worstContrast(spec.brandInk as Rgb, backdrop),
      }
    : bestInk([LIGHT_INK, DARK_INK], backdrop);
  const drawn = {
    text,
    lines,
    font: {
      family: context.fontFamily,
      weight: 700 as const,
      fallback: context.fallback(text),
    },
    size,
  };
  if (ratio >= LOGO_MIN_CONTRAST) {
    return {
      layout: {
        kind: "wordmark",
        box,
        decision: "wordmark",
        corner: "bottom_right",
        ink: toHex(ink),
        contrast: round(ratio),
        panel: null,
        wordmark: drawn,
      },
    };
  }
  if (geometry === 1) return { reason: "the wordmark lacks contrast" };
  const placed = neutralPanel(w, h, geometry, null);
  return {
    layout: {
      kind: "wordmark",
      box: placed.inner,
      decision: "panel",
      corner: "bottom_right",
      ink: placed.ink,
      contrast: round(placed.contrast),
      panel: placed.panel,
      wordmark: drawn,
    },
  };
}
