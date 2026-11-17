import { JUDGE_MAX_SHOWN } from "@/lib/config";
import type { Angle, SupportingElement } from "./types";

// A candidate that reached the judge panel. `rank` is its Borda place (1 is best).
export type Contender = {
  index: number;
  angle: Angle;
  element: SupportingElement | null;
  rank: number;
  pass: boolean;
};

export type Selection = {
  // Candidate indexes to show, best rank first.
  shown: number[];
  // Elements turned on that the shown creatives miss. Only set when a full set of three is shown, since coverage is required then.
  missing: SupportingElement[];
};

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  return items.flatMap((item, i) =>
    combinations(items.slice(i + 1), size - 1).map((rest) => [item, ...rest]),
  );
}

const covered = (set: Contender[], on: SupportingElement[]) =>
  on.filter((element) => set.some((c) => c.element === element));

// Of the passing candidates, the set of up to three that covers the most elements turned on, then differs most in angle, then ranks best. Fewer than three passing are all shown; none is an empty selection.
export function select(
  contenders: Contender[],
  on: SupportingElement[],
): Selection {
  const passing = contenders
    .filter((contender) => contender.pass)
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  if (passing.length < JUDGE_MAX_SHOWN) {
    return { shown: passing.map((c) => c.index), missing: [] };
  }

  const score = (set: Contender[]) => ({
    covers: covered(set, on).length,
    angles: new Set(set.map((c) => c.angle)).size,
    rank: set.reduce((sum, c) => sum + c.rank, 0),
  });
  let best = passing.slice(0, JUDGE_MAX_SHOWN);
  for (const set of combinations(passing, JUDGE_MAX_SHOWN)) {
    const a = score(set);
    const b = score(best);
    if (
      a.covers > b.covers ||
      (a.covers === b.covers &&
        (a.angles > b.angles || (a.angles === b.angles && a.rank < b.rank)))
    ) {
      best = set;
    }
  }
  const have = new Set(covered(best, on));
  return {
    shown: best.map((c) => c.index),
    missing: on.filter((element) => !have.has(element)),
  };
}
