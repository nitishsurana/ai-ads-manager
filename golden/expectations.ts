import { readFileSync } from "node:fs";
import { z } from "zod";

const ratingSchema = z.strictObject({
  value: z.number(),
  count: z.number().int(),
  show: z.boolean(),
});

const expectationSchema = z.strictObject({
  note: z.string().optional(),
  // A photo judgement the model and the CSV disagree on: the expected values stay the CSV's, a mismatch on the judgement fields is reported as TRIAGE while the output equals triageActual, and anything else fails.
  triage: z.string().optional(),
  triageActual: z
    .strictObject({
      shownPhotos: z.number().int().optional(),
      droppedPositions: z.array(z.number().int()).optional(),
      dropReasons: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  message: z.string().nullable(),
  existingWorkspaceId: z.string().optional(),
  existingWorkspaces: z.record(z.string(), z.string()).optional(),
  productKey: z.string().optional(),
  finalUrl: z.string().optional(),
  market: z.string().optional(),
  price: z.string().optional(),
  wasPrice: z.string().nullable().optional(),
  currency: z.string().optional(),
  purchase: z.enum(["purchasable", "not_purchasable"]).optional(),
  needsVariantChoice: z.boolean().optional(),
  buyableVariants: z.number().int().optional(),
  rating: ratingSchema.nullable().optional(),
  warnings: z.array(z.string()).optional(),
  uniquePhotos: z.number().int().optional(),
  shownPhotos: z.number().int().optional(),
  droppedPositions: z.array(z.number().int()).optional(),
  dropReasons: z.record(z.string(), z.string()).optional(),
  duplicatePositions: z.array(z.number().int()).optional(),
  // The intake is expected to throw (the tester sees the generic retry message) with this text in the error.
  throws: z.string().optional(),
  skippedPositions: z.array(z.number().int()).optional(),
  escalatedPositions: z.array(z.number().int()).optional(),
  lowResWarning: z.boolean().optional(),
  textWarning: z.boolean().optional(),
});

export type Expectation = z.infer<typeof expectationSchema>;

export function loadExpectations() {
  const raw: unknown = JSON.parse(
    readFileSync("golden/expectations.json", "utf8"),
  );
  return z.record(z.string(), expectationSchema).parse(raw);
}
