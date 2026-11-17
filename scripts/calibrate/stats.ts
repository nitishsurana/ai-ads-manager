export const MIN_N = 5;

export const mean = (values: number[]) =>
  values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;

// 1-based ranks, tied values sharing the average of their places.
export function ranks(values: number[]) {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const out = Array.from({ length: values.length }, () => 0);
  for (let start = 0; start < order.length;) {
    let end = start;
    while (order[end + 1]?.value === order[start]?.value) end++;
    for (let i = start; i <= end; i++) {
      out[(order[i] as { index: number }).index] = (start + end) / 2 + 1;
    }
    start = end + 1;
  }
  return out;
}

// The chance a random approved creative outscores a random rejected one, ties counting half (Mann-Whitney U over ranks).
export function auc(scores: number[], approved: boolean[]) {
  const positives = approved.filter(Boolean).length;
  const negatives = approved.length - positives;
  if (positives === 0 || negatives === 0) return null;
  const rank = ranks(scores);
  const positiveRanks = rank.reduce(
    (sum, value, i) => sum + (approved[i] ? value : 0),
    0,
  );
  return (
    (positiveRanks - (positives * (positives + 1)) / 2) /
    (positives * negatives)
  );
}

export type Agreement = {
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  kappa: number | null;
};

const ratio = (top: number, bottom: number) =>
  bottom === 0 ? null : top / bottom;

// A prediction against the human's approve, as plain agreement and chance-corrected kappa.
export function agreement(
  predicted: boolean[],
  approved: boolean[],
): Agreement {
  const count = (guess: boolean, human: boolean) =>
    predicted.filter((p, i) => p === guess && approved[i] === human).length;
  const tp = count(true, true);
  const fp = count(true, false);
  const fn = count(false, true);
  const tn = count(false, false);
  const n = tp + fp + fn + tn;
  const chance =
    n === 0 ? 0 : ((tp + fp) * (tp + fn) + (fn + tn) * (fp + tn)) / (n * n);
  const observed = n === 0 ? 0 : (tp + tn) / n;
  return {
    accuracy: ratio(tp + tn, n),
    precision: ratio(tp, tp + fp),
    recall: ratio(tp, tp + fn),
    kappa: n === 0 || chance === 1 ? null : (observed - chance) / (1 - chance),
  };
}
