import { JUDGE_FAIL_MEDIAN, JUDGE_PASS_MEAN } from "@/lib/config";
import type { RoundInputs } from "@/lib/round/inputs";
import { elementsOn } from "@/lib/round/plan";
import type { Candidate } from "@/lib/round/types";
import { allowedPhotoIds } from "./assert";
import { renderProblems } from "./assert-render";

export const ROUND_DEADLINE_MS = 180_000;

// The plan's round pass bar for one row, written from the spec: at least one creative shown; each shown creative passes Layer 1 (the production checks run again, and the independent geometry rules); coverage when three are shown; the photo rules; the logo the CSV expects (from expectations.json, not from what the app froze); and the round (the file name is checked in the runner tables and deferred to the Phase 7 downloads) inside its deadline.
export async function barProblems(input: {
  inputs: RoundInputs;
  shown: Candidate[];
  previews: Buffer[];
  backgrounds: Buffer[];
  elapsedMs: number;
  // What the CSV's confirmed answers say the logo is: its source (null for none) and the typed brand name.
  logo: { source: string | null; name: string | null };
  recheck: (candidate: Candidate) => Promise<string[]>;
}) {
  const { inputs, shown } = input;
  const problems: string[] = [];
  if (shown.length === 0) problems.push("no creative was shown");
  if (input.elapsedMs > ROUND_DEADLINE_MS) {
    problems.push(
      `the round took ${Math.round(input.elapsedMs / 1000)} s, over 180`,
    );
  }

  const photos = allowedPhotoIds(inputs);
  for (const [i, candidate] of shown.entries()) {
    const label = `creative ${i + 1} (candidate ${candidate.index})`;
    const add = (message: string) => problems.push(`${label}: ${message}`);
    for (const failure of await input.recheck(candidate))
      add(`Layer 1: ${failure}`);
    for (const failure of await renderProblems(inputs, {
      candidate,
      preview: input.previews[i] ?? Buffer.alloc(0),
      background: input.backgrounds[i] ?? Buffer.alloc(0),
    })) {
      add(failure.replace(/^candidate \d+: /, ""));
    }
    if (!photos.includes(candidate.photoId))
      add(`photo ${candidate.photoId} is not allowed`);

    const { layout, judge } = candidate;
    const logo = layout?.logo ?? null;
    const dropped = layout?.dropped.some((d) => d.element === "logo");
    if (input.logo.source === null) {
      if (logo) add("a logo is drawn but the CSV expects none");
    } else if (!logo) {
      if (!dropped) add("the logo is missing");
    } else if (input.logo.source === "wordmark") {
      if (logo.kind !== "wordmark" || logo.wordmark?.text !== input.logo.name) {
        add(`the wordmark "${input.logo.name}" is not drawn`);
      }
    } else if (logo.kind !== "image" && !logo.wordmark) {
      add("the logo is neither the image nor its wordmark fallback");
    }

    if (!judge) add("no judge record");
    else if (
      !judge.pass ||
      judge.mean < JUDGE_PASS_MEAN ||
      Object.values(judge.medians).includes(JUDGE_FAIL_MEDIAN)
    ) {
      add("it was shown but does not pass the judge rule");
    }
  }

  if (shown.length === 3) {
    for (const element of elementsOn(inputs)) {
      if (!shown.some((c) => c.supportingElement === element)) {
        problems.push(`three shown but none carries the ${element} badge`);
      }
    }
  }
  return problems;
}
