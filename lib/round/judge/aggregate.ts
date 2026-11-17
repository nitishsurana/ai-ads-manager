import {
  JUDGE_DISAGREEMENT,
  JUDGE_FAIL_MEDIAN,
  JUDGE_PASS_MEAN,
} from "@/lib/config";
import { CRITERIA, type JudgeRecord, type Scores } from "./schema";

// One judge's view of the panel's candidates, all in candidate order.
export type Vote = {
  model: string;
  scores: Scores[];
  reasons: JudgeRecord["judges"][number]["reasons"][];
  // Candidate positions, best first.
  ranking: number[];
};

export function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// Medians per criterion, the low-confidence flag, the pass rule and the Borda ranking over every judge's order. One judge alone can't disagree with anyone, so it is flagged.
export function aggregate(votes: Vote[], count: number): JudgeRecord[] {
  const borda = Array.from({ length: count }, () => 0);
  for (const vote of votes) {
    vote.ranking.forEach((position, place) => {
      borda[position] = (borda[position] ?? 0) + (count - 1 - place);
    });
  }

  const records = Array.from({ length: count }, (_, position) => {
    const scores = votes.map((vote) => vote.scores[position] as Scores);
    const medians = Object.fromEntries(
      CRITERIA.map((criterion) => [
        criterion,
        median(scores.map((score) => score[criterion])),
      ]),
    ) as Scores;
    const values = CRITERIA.map((criterion) => medians[criterion]);
    const lowConfidence =
      votes.length < 2 ||
      CRITERIA.some((criterion) => {
        const each = scores.map((score) => score[criterion]);
        return Math.max(...each) - Math.min(...each) >= JUDGE_DISAGREEMENT;
      });
    return {
      medians,
      mean: mean(values),
      lowConfidence,
      pass:
        mean(values) >= JUDGE_PASS_MEAN &&
        values.every((value) => value !== JUDGE_FAIL_MEDIAN),
      borda: borda[position] ?? 0,
      rank: 0,
      judges: votes.map((vote) => ({
        model: vote.model,
        scores: vote.scores[position] as Scores,
        reasons: vote.reasons[position] as Vote["reasons"][number],
        rank: vote.ranking.indexOf(position) + 1,
      })),
    };
  });

  const order = records
    .map((record, position) => ({ record, position }))
    .sort(
      (a, b) =>
        b.record.borda - a.record.borda ||
        b.record.mean - a.record.mean ||
        a.position - b.position,
    );
  order.forEach(({ record }, place) => {
    record.rank = place + 1;
  });
  return records;
}
