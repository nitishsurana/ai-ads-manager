import { aggregate, readVote, shuffled } from "@/lib/round/judge";
import { CRITERIA, type Scores } from "@/lib/round/judge/schema";
import type { JudgeAnswer } from "@/lib/round/judge/schema";
import type { Vote } from "@/lib/round/judge/aggregate";
import { select, type Contender } from "@/lib/round/select";
import type { Angle, SupportingElement } from "@/lib/round/types";
import { same, type Case } from "./cases";

const flat = (score: number, over: Partial<Scores> = {}): Scores => ({
  message: score,
  hierarchy: score,
  product: score,
  brand_fit: score,
  slop: score,
  ...over,
});

const reasons = Object.fromEntries(
  CRITERIA.map((c) => [c, "r"]),
) as Vote["reasons"][number];

const vote = (model: string, scores: Scores[], ranking: number[]): Vote => ({
  model,
  scores,
  reasons: scores.map(() => reasons),
  ranking,
});

const summary = (votes: Vote[], count: number) =>
  aggregate(votes, count).map(
    ({ medians, mean, lowConfidence, pass, borda, rank }) => ({
      mean,
      lowConfidence,
      pass,
      borda,
      rank,
      message: medians.message,
    }),
  );

const JUDGE_CASES: Case[] = [
  {
    name: "judge: medians ignore one outlier, and the mean of medians is the roll-up",
    run: () => {
      const [only] = aggregate(
        [
          vote("a", [flat(5)], [0]),
          vote("b", [flat(4)], [0]),
          vote("c", [flat(1)], [0]),
        ],
        1,
      );
      return same([only?.medians, only?.mean, only?.pass], [flat(4), 4, true]);
    },
  },
  {
    name: "judge: a criterion median of 1 fails a creative whose mean is high",
    run: () => {
      const votes = ["a", "b", "c"].map((m) =>
        vote(m, [flat(5, { slop: 1 })], [0]),
      );
      const [only] = aggregate(votes, 1);
      return same([only?.mean, only?.pass], [4.2, false]);
    },
  },
  {
    name: "judge: a mean of exactly 3.0 passes and 2.8 does not",
    run: () => {
      const at = (scores: Scores) =>
        aggregate(
          ["a", "b", "c"].map((m) => vote(m, [scores], [0])),
          1,
        )[0]?.pass;
      return same(
        [
          at(flat(3)),
          at(flat(3, { message: 2, hierarchy: 2, brand_fit: 4, slop: 4 })),
          at(flat(2, { brand_fit: 4, slop: 4 })),
        ],
        [true, true, false],
      );
    },
  },
  {
    name: "judge: judges 2 apart on any criterion are low confidence; 1 apart is not; one judge alone is",
    run: () => {
      const flagged = (a: number, b: number, c: number) =>
        aggregate(
          [
            vote("a", [flat(4, { product: a })], [0]),
            vote("b", [flat(4, { product: b })], [0]),
            vote("c", [flat(4, { product: c })], [0]),
          ],
          1,
        )[0]?.lowConfidence;
      const alone = aggregate([vote("a", [flat(4)], [0])], 1)[0]?.lowConfidence;
      return same(
        [flagged(5, 4, 3), flagged(4, 5, 4), flagged(2, 2, 2), alone],
        [true, false, false, true],
      );
    },
  },
  {
    name: "judge: Borda points over each judge's order, with ranks 1 to n",
    run: () =>
      same(
        summary(
          [
            vote("a", [flat(4), flat(4), flat(4)], [0, 1, 2]),
            vote("b", [flat(4), flat(4), flat(4)], [1, 0, 2]),
            vote("c", [flat(4), flat(4), flat(4)], [0, 2, 1]),
          ],
          3,
        ).map(({ borda, rank }) => [borda, rank]),
        [
          [5, 1],
          [3, 2],
          [1, 3],
        ],
      ),
  },
  {
    name: "judge: a Borda tie goes to the higher mean, then to the earlier candidate",
    run: () =>
      same(
        summary(
          [
            vote("a", [flat(3), flat(5), flat(5)], [0, 1, 2]),
            vote("b", [flat(3), flat(5), flat(5)], [1, 0, 2]),
          ],
          3,
        ).map(({ borda, rank }) => [borda, rank]),
        [
          [3, 2],
          [3, 1],
          [0, 3],
        ],
      ),
  },
];

const answer = (over: Partial<JudgeAnswer> = {}): JudgeAnswer => ({
  creatives: [1, 2].map((id) => ({
    id,
    message: { reason: "r", score: id === 1 ? 5 : 2 },
    hierarchy: { reason: "r", score: 4 },
    product: { reason: "r", score: 4 },
    brand_fit: { reason: "r", score: 4 },
    slop: { reason: "r", score: 4 },
  })),
  ranking: [1, 2],
  ...over,
});

const VOTE_CASES: Case[] = [
  {
    name: "judge answer: labels map back to candidate positions and the ranking with them",
    run: () => {
      // The images were shown as candidate 1, then candidate 0.
      const read = readVote("m", answer({ ranking: [2, 1] }), [1, 0]);
      return same(
        [read?.scores[1]?.message, read?.scores[0]?.message, read?.ranking],
        [5, 2, [0, 1]],
      );
    },
  },
  {
    name: "judge answer: a score of 6, a fraction, a repeated or missing creative make the answer unusable",
    run: () => {
      const bad = (creatives: JudgeAnswer["creatives"]) =>
        readVote("m", answer({ creatives }), [0, 1]);
      const base = answer().creatives;
      const first = base[0];
      if (!first) return "no base";
      return same(
        [
          bad([
            { ...first, message: { reason: "r", score: 6 } },
            ...base.slice(1),
          ]),
          bad([
            { ...first, slop: { reason: "r", score: 3.5 } },
            ...base.slice(1),
          ]),
          bad([first, first]),
          bad([first]),
        ],
        [null, null, null, null],
      );
    },
  },
  {
    name: "judge answer: a ranking that is not a full ordering is rebuilt from the scores",
    run: () =>
      same(readVote("m", answer({ ranking: [2] }), [0, 1])?.ranking, [0, 1]),
  },
  {
    name: "judge: the shuffle is a permutation that replays for the same seed",
    run: () => {
      const items = [0, 1, 2, 3, 4, 5];
      const a = shuffled(items, "round:1:model");
      const b = shuffled(items, "round:1:model");
      const c = shuffled(items, "round:1:other");
      return same([[...a].sort(), a, c.join() !== a.join()], [items, b, true]);
    },
  },
];

const contender = (
  index: number,
  rank: number,
  angle: Angle,
  element: SupportingElement | null,
  pass = true,
): Contender => ({ index, rank, angle, element, pass });

const SELECT_CASES: Case[] = [
  {
    name: "select: none passing is an empty selection",
    run: () =>
      same(select([contender(0, 1, "benefit", null, false)], ["price"]), {
        shown: [],
        missing: [],
      }),
  },
  {
    name: "select: fewer than three passing are all shown, best first, with no coverage required",
    run: () =>
      same(
        select(
          [
            contender(0, 3, "benefit", null),
            contender(1, 1, "lifestyle", null),
            contender(2, 2, "price", "price", false),
          ],
          ["price", "rating"],
        ),
        { shown: [1, 0], missing: [] },
      ),
  },
  {
    name: "select: the best three that cover every element beat a better-ranked set that does not",
    run: () =>
      same(
        select(
          [
            contender(0, 1, "benefit", "price"),
            contender(1, 2, "lifestyle", null),
            contender(2, 3, "feature_close_up", null),
            contender(3, 4, "social_proof", "rating"),
          ],
          ["price", "rating"],
        ),
        { shown: [0, 1, 3], missing: [] },
      ),
  },
  {
    name: "select: when no passing candidate shows an element, the rest are shown and the element is reported missing",
    run: () =>
      same(
        select(
          [
            contender(0, 1, "benefit", "price"),
            contender(1, 2, "lifestyle", null),
            contender(2, 3, "feature_close_up", null),
            contender(3, 4, "benefit", null),
          ],
          ["price", "rating"],
        ),
        { shown: [0, 1, 2], missing: ["rating"] },
      ),
  },
  {
    name: "select: a set that differs in angle beats a better-ranked set of one angle",
    run: () =>
      same(
        select(
          [
            contender(0, 1, "benefit", null),
            contender(1, 2, "benefit", null),
            contender(2, 3, "benefit", null),
            contender(3, 4, "lifestyle", null),
            contender(4, 5, "feature_close_up", null),
          ],
          [],
        ),
        { shown: [0, 3, 4], missing: [] },
      ),
  },
  {
    name: "select: exactly three passing out of four candidates are all shown",
    run: () =>
      same(
        select(
          [
            contender(0, 2, "benefit", null),
            contender(1, 1, "lifestyle", null),
            contender(2, 4, "price", null),
            contender(3, 3, "offer", null, false),
          ],
          [],
        ).shown,
        [1, 0, 2],
      ),
  },
];

export const JUDGE_TABLES: Case[] = [
  ...JUDGE_CASES,
  ...VOTE_CASES,
  ...SELECT_CASES,
];
