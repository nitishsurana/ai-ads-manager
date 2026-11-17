import { z } from "zod";

export const CRITERIA = [
  "message",
  "hierarchy",
  "product",
  "brand_fit",
  "slop",
] as const;
export type Criterion = (typeof CRITERIA)[number];

const scored = z.object({ reason: z.string(), score: z.number() });

// The reason comes first so the model argues before it scores. Scores are range-checked in code: min/max in the schema is not accepted by every vendor's structured output.
export const judgeAnswerSchema = z.object({
  creatives: z.array(
    z.object({
      id: z.number(),
      message: scored,
      hierarchy: scored,
      product: scored,
      brand_fit: scored,
      slop: scored,
    }),
  ),
  ranking: z.array(z.number()),
});

export type JudgeAnswer = z.infer<typeof judgeAnswerSchema>;

const byCriterion = <T extends z.ZodType>(value: T) =>
  z.object({
    message: value,
    hierarchy: value,
    product: value,
    brand_fit: value,
    slop: value,
  });

// What creatives.judge holds for a shown creative; the admin view reads it.
export const judgeRecordSchema = z.object({
  medians: byCriterion(z.number()),
  // The admin roll-up: the mean of the medians.
  mean: z.number(),
  lowConfidence: z.boolean(),
  pass: z.boolean(),
  borda: z.number(),
  // 1 is best, among every creative that reached the panel.
  rank: z.number(),
  judges: z.array(
    z.object({
      model: z.string(),
      scores: byCriterion(z.number()),
      reasons: byCriterion(z.string()),
      rank: z.number(),
    }),
  ),
});

export type JudgeRecord = z.infer<typeof judgeRecordSchema>;
export type Scores = JudgeRecord["medians"];
