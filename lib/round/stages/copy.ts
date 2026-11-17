import {
  checkCopy,
  copyRequest,
  rewriteRequest,
  type CopyFailure,
} from "../copy";
import type { RoundInputs } from "../inputs";
import { rebalanceElements } from "../plan";
import type { Candidate, Copy, RoundContext } from "../types";
import type { StageDeps } from "./types";

const normalise = (copy: Copy): Copy => ({
  eyebrow: copy.eyebrow?.trim().toUpperCase() || null,
  headline: copy.headline.trim(),
  cta: copy.cta.trim(),
});

// The eyebrow is optional, so one with a problem (not a campaign tag, too long, a claim) is dropped before the headline is held to account.
function settle(copy: Copy, inputs: RoundInputs) {
  let failures = checkCopy(copy, inputs);
  let settled = copy;
  if (failures.some((failure) => failure.part === "eyebrow")) {
    settled = { ...copy, eyebrow: null };
    failures = checkCopy(settled, inputs);
  }
  return { copy: settled, failures };
}

type Checked = {
  candidate: Candidate;
  copy: Copy | null;
  failures: CopyFailure[];
};

const missing = (candidate: Candidate): Checked => ({
  candidate,
  copy: null,
  failures: [{ part: "headline", text: "no copy was returned" }],
});

// A later candidate that repeats a headline fails like any other.
function markRepeats(entries: Checked[]): Checked[] {
  const seen = new Set<string>();
  return entries.map((entry) => {
    if (!entry.copy) return entry;
    const key = entry.copy.headline.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      return entry;
    }
    const failure: CopyFailure = {
      part: "headline",
      text: "the headline repeats another candidate's",
    };
    return { ...entry, failures: [...entry.failures, failure] };
  });
}

export async function writeCopy(
  input: RoundContext,
  candidates: Candidate[],
  deps: StageDeps,
): Promise<Candidate[]> {
  const { inputs } = input;
  const brief = await deps.brief();
  const progress = (done: number) =>
    deps.progress({
      kind: "stage",
      stage: "writing_copy",
      done,
      total: candidates.length,
    });

  async function ask(
    request: ReturnType<typeof copyRequest>,
    wanted: Candidate[],
  ) {
    const { object } = await deps.ai.generate(request);
    return wanted.map((candidate): Checked => {
      const raw = object.candidates.find((c) => c.index === candidate.index);
      return raw
        ? { candidate, ...settle(normalise(raw), inputs) }
        : missing(candidate);
    });
  }

  const drafts = markRepeats(
    await ask(copyRequest(inputs, brief, candidates), candidates),
  );
  await progress(drafts.filter((draft) => draft.failures.length === 0).length);
  const failed = drafts.filter((draft) => draft.failures.length > 0);
  const rewritten =
    failed.length > 0
      ? await ask(
          rewriteRequest(inputs, brief, failed),
          failed.map((entry) => entry.candidate),
        )
      : [];

  const merged = new Map(drafts.map((entry) => [entry.candidate.index, entry]));
  for (const entry of rewritten) merged.set(entry.candidate.index, entry);
  const final = markRepeats(
    candidates.flatMap((candidate) => merged.get(candidate.index) ?? []),
  );

  const written = final.flatMap(({ candidate, copy, failures }) => {
    if (copy && failures.length === 0) return [{ ...candidate, copy }];
    console.warn(
      `round ${input.roundId}: candidate ${candidate.index} dropped: ${failures.map((f) => f.text).join("; ")}`,
    );
    return [];
  });
  await progress(candidates.length);
  if (written.length === 0) return [];

  const { candidates: balanced, short } = rebalanceElements(written, inputs);
  if (short.length > 0) {
    console.warn(
      `round ${input.roundId}: ${short.join(", ")} not covered twice after copy drops`,
    );
  }
  return balanced;
}
