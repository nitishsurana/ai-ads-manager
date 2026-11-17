import { createHash } from "node:crypto";
import sharp from "sharp";
import type { BriefContent } from "@/lib/brief/schema";
import { mapLimit } from "@/lib/intake";
import { isFatal } from "../stages/errors";
import type { StageDeps } from "../stages/types";
import type { RoundContext, Candidate } from "../types";
import { aggregate, type Vote } from "./aggregate";
import { JUDGE_MODELS, judgeRequest } from "./prompt";
import {
  CRITERIA,
  type JudgeAnswer,
  type JudgeRecord,
  type Scores,
} from "./schema";

export { aggregate, median } from "./aggregate";
export { JUDGE_MODELS } from "./prompt";
export { judgeRecordSchema, type JudgeRecord } from "./schema";

// A reason is stored for the admin view, so a rambling one is cut.
const REASON_MAX = 120;
const IMAGE = { width: 720, height: 1280, quality: 85 } as const;

// A shuffle that replays: the same round, judge and candidates give the same order.
export function shuffled<T>(items: T[], seed: string): T[] {
  const digest = createHash("sha256").update(seed).digest();
  let state = digest.readUInt32LE(0);
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

const validScore = (score: number) =>
  Number.isInteger(score) && score >= 1 && score <= 5;

// One judge's answer in candidate order, or null when it doesn't cover every creative with scores from 1 to 5. A ranking that isn't a full ordering is rebuilt from the scores.
export function readVote(
  model: string,
  answer: JudgeAnswer,
  // Candidate position of each label, in label order.
  positions: number[],
): Vote | null {
  const count = positions.length;
  const scores: Scores[] = new Array(count);
  const reasons: Vote["reasons"] = new Array(count);
  const seen = new Set<number>();
  for (const entry of answer.creatives) {
    const position = positions[entry.id - 1];
    if (position === undefined || seen.has(entry.id)) return null;
    seen.add(entry.id);
    if (!CRITERIA.every((criterion) => validScore(entry[criterion].score))) {
      return null;
    }
    scores[position] = Object.fromEntries(
      CRITERIA.map((criterion) => [criterion, entry[criterion].score]),
    ) as Scores;
    reasons[position] = Object.fromEntries(
      CRITERIA.map((criterion) => [
        criterion,
        entry[criterion].reason.slice(0, REASON_MAX),
      ]),
    ) as Vote["reasons"][number];
  }
  if (seen.size !== count) return null;

  const labels = new Set(answer.ranking);
  const ordered =
    answer.ranking.length === count &&
    labels.size === count &&
    answer.ranking.every((label) => positions[label - 1] !== undefined);
  const ranking = ordered
    ? answer.ranking.map((label) => positions[label - 1] as number)
    : [...scores.keys()].sort(
        (a, b) =>
          CRITERIA.reduce((sum, c) => sum + (scores[b]?.[c] ?? 0), 0) -
            CRITERIA.reduce((sum, c) => sum + (scores[a]?.[c] ?? 0), 0) ||
          a - b,
      );
  return { model, scores, reasons, ranking };
}

async function forJudge(preview: Buffer) {
  return sharp(preview)
    .resize(IMAGE.width, IMAGE.height)
    .jpeg({ quality: IMAGE.quality })
    .toBuffer();
}

// The three judges each see every creative in their own shuffled order, in parallel. A judge that fails or answers badly is left out and logged; with none left the stage fails.
export async function judgePanel(
  input: RoundContext,
  entries: { candidate: Candidate; preview: Buffer }[],
  brief: BriefContent,
  deps: Pick<StageDeps, "ai">,
): Promise<JudgeRecord[]> {
  const images = await Promise.all(
    entries.map((entry) => forJudge(entry.preview)),
  );
  const positions = entries.map((_, position) => position);
  const votes = await mapLimit(
    JUDGE_MODELS,
    JUDGE_MODELS.length,
    async (model) => {
      const order = shuffled(
        positions,
        `${input.roundId}:${input.attempt}:${model}:${entries.map((e) => e.candidate.index).join(",")}`,
      );
      try {
        const { object } = await deps.ai.generate(
          judgeRequest(
            model,
            input.inputs,
            brief,
            order.map((position) => ({
              candidate: entries[position]?.candidate as Candidate,
              image: images[position] as Buffer,
            })),
          ),
        );
        const vote = readVote(model, object, order);
        if (!vote)
          console.warn(
            `round ${input.roundId}: ${model} gave an unusable answer`,
          );
        return vote;
      } catch (error) {
        if (isFatal(error)) throw error;
        console.warn(`round ${input.roundId}: judge ${model} failed`, error);
        return null;
      }
    },
  );
  const usable = votes.filter((vote) => vote !== null);
  if (usable.length === 0) throw new Error("judge: every judge failed");
  return aggregate(usable, entries.length);
}
