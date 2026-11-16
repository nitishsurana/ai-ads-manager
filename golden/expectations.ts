import { readFileSync } from "node:fs";
import { z } from "zod";

const ratingSchema = z.strictObject({
  value: z.number(),
  count: z.number().int(),
  show: z.boolean(),
});

const expectationSchema = z.strictObject({
  note: z.string().optional(),
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
});

export type Expectation = z.infer<typeof expectationSchema>;

export function loadExpectations() {
  const raw: unknown = JSON.parse(
    readFileSync("golden/expectations.json", "utf8"),
  );
  return z.record(z.string(), expectationSchema).parse(raw);
}
