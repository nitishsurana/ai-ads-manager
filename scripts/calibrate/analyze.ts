import { disagreements, passes } from "@/lib/round/judge/aggregate";
import {
  CRITERIA,
  type Criterion,
  type JudgeRecord,
} from "@/lib/round/judge/schema";
import type { Sample } from "./load";
import { type Agreement, agreement, auc, mean, MIN_N } from "./stats";

type Reading = {
  overall: number;
  criteria: Record<Criterion, number>;
  pass: boolean | null;
};

type Scorer = { name: string; read: (record: JudgeRecord) => Reading | null };

export type Scored = {
  name: string;
  n: number;
  approved: number;
  rejected: number;
  meanApproved: number | null;
  meanRejected: number | null;
  gap: number | null;
  criteria: Record<
    Criterion,
    { approved: number | null; rejected: number | null }
  >;
  agreement: Agreement | "not measurable" | null;
  auc: number | null;
};

export type Skipped = { records: number; rounds: number };

export type Rate = { n: number; approved: number; rate: number | null };

export type Analysis = {
  rated: number;
  shown: number;
  skipped: Skipped;
  scorers: Scored[];
  lowConfidence: {
    rule: string;
    flagged: number;
    flaggedRate: Rate;
    unflaggedRate: Rate;
  }[];
  rankPositions: { group: string; rate: Rate }[];
  swapProxy: { group: string; rate: Rate }[];
};

const overall = (scores: Record<Criterion, number>) =>
  mean(CRITERIA.map((criterion) => scores[criterion])) as number;

const PANEL = "panel";

const panel: Scorer = {
  name: PANEL,
  read: (record) => ({
    overall: record.mean,
    criteria: record.medians,
    // Only passing creatives are shown, so the panel's verdict never varies.
    pass: null,
  }),
};

const judgeScorer = (model: string): Scorer => ({
  name: model,
  read: (record) => {
    const judge = record.judges.find((entry) => entry.model === model);
    if (!judge) return null;
    const average = overall(judge.scores);
    return {
      overall: average,
      criteria: judge.scores,
      pass: passes(CRITERIA.map((criterion) => judge.scores[criterion])),
    };
  },
});

const enough = <T>(n: number, value: T) => (n < MIN_N ? null : value);

function rate(samples: Sample[]): Rate {
  const approved = samples.filter((s) => s.rating === "approve").length;
  return {
    n: samples.length,
    approved,
    rate: enough(
      samples.length,
      samples.length ? approved / samples.length : null,
    ),
  };
}

const groupMean = (readings: Reading[], value: (r: Reading) => number) =>
  enough(readings.length, mean(readings.map(value)));

function score(scorer: Scorer, rated: Sample[]): Scored {
  const pairs = rated.flatMap((sample) => {
    const reading = scorer.read(sample.record);
    return reading ? [{ reading, approved: sample.rating === "approve" }] : [];
  });
  const yes = pairs.filter((p) => p.approved).map((p) => p.reading);
  const no = pairs.filter((p) => !p.approved).map((p) => p.reading);
  const meanYes = groupMean(yes, (r) => r.overall);
  const meanNo = groupMean(no, (r) => r.overall);
  const labels = pairs.map((p) => p.approved);
  const smaller = Math.min(yes.length, no.length);
  return {
    name: scorer.name,
    n: pairs.length,
    approved: yes.length,
    rejected: no.length,
    meanApproved: meanYes,
    meanRejected: meanNo,
    gap: meanYes !== null && meanNo !== null ? meanYes - meanNo : null,
    criteria: Object.fromEntries(
      CRITERIA.map((criterion) => [
        criterion,
        {
          approved: groupMean(yes, (r) => r.criteria[criterion]),
          rejected: groupMean(no, (r) => r.criteria[criterion]),
        },
      ]),
    ) as Scored["criteria"],
    agreement:
      scorer.name === PANEL
        ? "not measurable"
        : enough(
            smaller,
            agreement(
              pairs.map((p) => p.reading.pass === true),
              labels,
            ),
          ),
    auc: enough(
      smaller,
      auc(
        pairs.map((p) => p.reading.overall),
        labels,
      ),
    ),
  };
}

const LOW_CONFIDENCE_RULES: {
  rule: string;
  flagged: (record: JudgeRecord) => boolean;
}[] = [
  {
    rule: "stored flag (spread >= 2 on any criterion, or fewer than 2 judges answered)",
    flagged: (r) => r.lowConfidence,
  },
  {
    rule: "spread >= 2 on at least 2 criteria",
    flagged: (r) => disagreements(r.judges.map((j) => j.scores)) >= 2,
  },
];

const group = (name: string, samples: Sample[]) => ({
  group: name,
  rate: rate(samples),
});

export function analyze(samples: Sample[], skipped: Skipped): Analysis {
  const rated = samples.filter((sample) => sample.rating !== null);
  const models = [
    ...new Set(samples.flatMap((s) => s.record.judges.map((j) => j.model))),
  ].sort();
  const place = (s: Sample) => Math.min(s.record.rank, 4);
  return {
    rated: rated.length,
    shown: samples.length,
    skipped,
    scorers: [panel, ...models.map(judgeScorer)].map((scorer) =>
      score(scorer, rated),
    ),
    lowConfidence: LOW_CONFIDENCE_RULES.map(({ rule, flagged }) => ({
      rule,
      flagged: samples.filter((s) => flagged(s.record)).length,
      flaggedRate: rate(rated.filter((s) => flagged(s.record))),
      unflaggedRate: rate(rated.filter((s) => !flagged(s.record))),
    })),
    rankPositions: [1, 2, 3, 4].map((p) =>
      group(
        p === 4 ? "rank 4+" : `rank ${p}`,
        rated.filter((s) => place(s) === p),
      ),
    ),
    swapProxy: [
      group(
        "rank within shown count",
        rated.filter((s) => s.record.rank <= s.shown),
      ),
      group(
        "rank beyond shown count",
        rated.filter((s) => s.record.rank > s.shown),
      ),
    ],
  };
}
