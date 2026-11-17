import type { Candidate, Copy, RoundContext } from "../types";
import type { StageDeps } from "./types";

const HEADLINE_WORDS = 6;
const HEADLINE_CHARS = 75;
const COPY_WORDS = 8;

// STUB (6a): gpt-6.1-sol copy with the limits and one rewrite replaces this in 6b.
function stubCopy({ inputs }: RoundContext): Copy {
  const words = inputs.productTitle.split(/\s+/).filter(Boolean);
  const headline = words
    .slice(0, HEADLINE_WORDS)
    .join(" ")
    .slice(0, HEADLINE_CHARS);
  const eyebrow = inputs.campaign.occasion?.toUpperCase() ?? null;
  const fits =
    eyebrow !== null &&
    eyebrow.split(/\s+/).length + headline.split(/\s+/).length <= COPY_WORDS;
  return { eyebrow: fits ? eyebrow : null, headline, cta: "Shop now" };
}

export async function writeCopy(
  input: RoundContext,
  candidates: Candidate[],
  deps: StageDeps,
): Promise<Candidate[]> {
  const copy = stubCopy(input);
  const written: Candidate[] = [];
  for (const candidate of candidates) {
    written.push({ ...candidate, copy });
    await deps.progress({
      kind: "stage",
      stage: "writing_copy",
      done: written.length,
      total: candidates.length,
    });
  }
  return written;
}
