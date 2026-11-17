import { CRITERIA } from "@/lib/round/judge/schema";
import { MIN_N } from "./stats";
import type { Analysis, Rate, Scored } from "./analyze";

const TOO_FEW = "too few to judge";

// n is the size of the group behind the value: under MIN_N it is too few, and a null beyond that is undefined (a ratio over nothing).
const num = (value: number | null, n: number, digits = 2) =>
  n < MIN_N ? TOO_FEW : value === null ? "n/a" : value.toFixed(digits);

const pct = (rate: Rate) =>
  `${num(rate.rate === null ? null : rate.rate * 100, rate.n, 0)}${rate.rate === null ? "" : "%"} (${rate.approved}/${rate.n})`;

function scorer(s: Scored) {
  const smaller = Math.min(s.approved, s.rejected);
  const a = s.agreement;
  const agree =
    a === "not measurable"
      ? "not measurable: only creatives that passed the panel are stored"
      : `accuracy ${num(a?.accuracy ?? null, smaller)}  precision ${num(a?.precision ?? null, smaller)}  recall ${num(a?.recall ?? null, smaller)}  kappa ${num(a?.kappa ?? null, smaller)}`;
  return [
    `${s.name}  n=${s.n} (approved ${s.approved}, rejected ${s.rejected})`,
    `  mean score  approved ${num(s.meanApproved, s.approved)}  rejected ${num(s.meanRejected, s.rejected)}  gap ${num(s.gap, smaller)}`,
    `  "says pass" vs human approve  ${agree}`,
    `  AUC (chance an approved creative outscores a rejected one; 0.5 is no signal) ${num(s.auc, smaller)}`,
    ...CRITERIA.map(
      (criterion) =>
        `  ${criterion.padEnd(9)} approved ${num(s.criteria[criterion].approved, s.approved)}  rejected ${num(s.criteria[criterion].rejected, s.rejected)}`,
    ),
  ];
}

export function formatReport(analysis: Analysis) {
  const lines = [
    `Calibration: ${analysis.shown} shown creatives, ${analysis.rated} rated by humans. Groups under 5 print "${TOO_FEW}"; "n/a" is a ratio over nothing.`,
    `Skipped: ${analysis.skipped.records} unreadable judge records, ${analysis.skipped.rounds} rounds with no workspace.`,
    "Every number is conditional on the creative having passed the panel and been selected, which also narrows the score range, so AUC and the approved/rejected gap tend to understate every scorer's signal.",
    "",
    ...analysis.scorers.flatMap((s) => [...scorer(s), ""]),
    "Low confidence",
    ...analysis.lowConfidence.map(
      (l) =>
        `  ${l.rule}: flagged ${l.flagged}/${analysis.shown}  approval flagged ${pct(l.flaggedRate)}  unflagged ${pct(l.unflaggedRate)}`,
    ),
    "",
    "Approval by panel rank (Borda place within the round)",
    ...analysis.rankPositions.map((r) => `  ${r.group}: ${pct(r.rate)}`),
    "",
    "Swap-in proxy (judge records are kept only for shown creatives, so a swap for angle coverage is not stored; a creative ranked beyond the number shown was swapped in or ranked behind creatives that failed the pass rule)",
    ...analysis.swapProxy.map((r) => `  ${r.group}: ${pct(r.rate)}`),
  ];
  return lines.join("\n");
}
