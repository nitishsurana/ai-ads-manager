import { disagreements, passes } from "@/lib/round/judge/aggregate";
import { agreement, auc, ranks } from "./stats";

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const near = (a: number | null, b: number) =>
  a !== null && Math.abs(a - b) < 1e-9;

// Expected values worked out by hand.
const CHECKS: [string, () => boolean][] = [
  ["ranks average ties", () => same(ranks([10, 20, 20, 30]), [1, 2.5, 2.5, 4])],
  ["ranks of a constant", () => same(ranks([5, 5, 5]), [2, 2, 2])],
  [
    // approved [4,3,2] vs rejected [3,1]: six pairs, 4 wins, 1 tie, 1 loss = 4.5/6
    "auc with a tie",
    () => near(auc([4, 3, 2, 3, 1], [true, true, true, false, false]), 0.75),
  ],
  ["auc perfect", () => near(auc([2, 1], [true, false]), 1)],
  ["auc with one class", () => auc([1, 2], [true, true]) === null],
  [
    // tp 3, fp 1, fn 1, tn 3: accuracy .75; chance .5; kappa .5
    "agreement and kappa",
    () => {
      const a = agreement(
        [true, true, true, true, false, false, false, false],
        [true, true, true, false, true, false, false, false],
      );
      return (
        near(a.accuracy, 0.75) &&
        near(a.precision, 0.75) &&
        near(a.recall, 0.75) &&
        near(a.kappa, 0.5)
      );
    },
  ],
  [
    "agreement with no predicted positives",
    () => {
      const a = agreement([false, false], [true, false]);
      return a.precision === null && near(a.recall, 0) && near(a.kappa, 0);
    },
  ],
  ["kappa of nothing", () => agreement([], []).kappa === null],
  [
    "pass rule needs mean 3 and no criterion of 1",
    () =>
      passes([3, 3, 3, 3, 3]) &&
      passes([5, 5, 4, 2, 2]) &&
      !passes([5, 5, 5, 1, 4]) &&
      !passes([3, 3, 3, 3, 2]),
  ],
  [
    "disagreements count criteria spread by 2 or more",
    () => {
      const s = (m: number, h: number, p: number, b: number, l: number) => ({
        message: m,
        hierarchy: h,
        product: p,
        brand_fit: b,
        slop: l,
      });
      return (
        disagreements([s(3, 3, 3, 3, 3), s(4, 4, 4, 4, 4)]) === 0 &&
        disagreements([s(1, 3, 3, 3, 3), s(3, 5, 3, 3, 3)]) === 2
      );
    },
  ],
  [
    "kappa when chance is certain",
    () => agreement([true, true], [true, true]).kappa === null,
  ],
];

export function selfTest() {
  const failed = CHECKS.filter(([, check]) => !check());
  for (const [name] of CHECKS) {
    console.log(
      `${failed.some(([f]) => f === name) ? "FAIL" : "PASS"} ${name}`,
    );
  }
  return failed.length === 0;
}
