import type { Copy } from "@/lib/round/types";
import { BLOCK_GAP, DESIGN, SAFE_BOX } from "./canvas";
import { fitText, sizeRange, type Fit } from "./fit";
import type { Measure } from "./measure";

export const HEADLINE_LINE = 1.05;
export const EYEBROW_LINE = 1.2;
const HEADLINE_MIN = 56;
const EYEBROW_MIN = 22;
const HEADLINE_SIZES = sizeRange(DESIGN.headlineSize, HEADLINE_MIN, 4);
const EYEBROW_SIZES = sizeRange(DESIGN.eyebrowSize, EYEBROW_MIN, 2);

export type Block = {
  headline: Fit;
  eyebrow: Fit | undefined;
  eyebrowHeight: number;
  height: number;
};

const headlineFit = (text: string, measure: Measure, sizes: number[]) =>
  fitText(text, measure, {
    maxWidth: SAFE_BOX.w,
    maxLines: 3,
    sizes,
    weight: 700,
  });

const eyebrowFit = (text: string, measure: Measure, sizes: number[]) =>
  [1, 2]
    .map((maxLines) =>
      fitText(text, measure, {
        maxWidth: SAFE_BOX.w,
        maxLines,
        sizes,
        weight: 700,
        tracking: DESIGN.eyebrowTracking,
      }),
    )
    .find((fit) => fit.fits);

function blockOf(headline: Fit, eyebrow: Fit | undefined): Block {
  const eyebrowHeight = eyebrow
    ? Math.ceil(eyebrow.lines.length * eyebrow.size * EYEBROW_LINE)
    : 0;
  const headHeight = Math.ceil(
    headline.lines.length * headline.size * HEADLINE_LINE,
  );
  return {
    headline,
    eyebrow,
    eyebrowHeight,
    height: eyebrowHeight + (eyebrow ? BLOCK_GAP : 0) + headHeight,
  };
}

// The eyebrow and headline at their natural sizes, then each smaller step: the headline down to its minimum, then the eyebrow down to its minimum. Each size is re-wrapped, so a step can drop a line.
export function blockSteps(
  copy: Copy,
  faces: { heading: Measure; body: Measure },
): Block[] {
  const headline = headlineFit(copy.headline, faces.heading, HEADLINE_SIZES);
  const eyebrow = copy.eyebrow
    ? eyebrowFit(copy.eyebrow, faces.body, EYEBROW_SIZES)
    : undefined;
  const steps = [blockOf(headline, eyebrow)];
  let smallest = headline;
  for (const size of HEADLINE_SIZES.filter((s) => s < headline.size)) {
    smallest = headlineFit(copy.headline, faces.heading, [size]);
    steps.push(blockOf(smallest, eyebrow));
  }
  if (copy.eyebrow && eyebrow) {
    for (const size of EYEBROW_SIZES.filter((s) => s < eyebrow.size)) {
      const smaller = eyebrowFit(copy.eyebrow, faces.body, [size]);
      if (smaller) steps.push(blockOf(smallest, smaller));
    }
  }
  return steps;
}
