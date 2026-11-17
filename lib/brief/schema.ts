import { z } from "zod";
import { campaignPatchSchema } from "@/lib/chat/campaign";
import { researchSchema } from "@/lib/chat/types";
import type { ConfirmedValues } from "@/lib/confirm";

export const confirmedValuesSchema = z.object({
  price: z.string().nullable(),
  wasPrice: z.string().nullable(),
  currency: z.string(),
  rating: z.object({ value: z.number(), count: z.number() }).nullable(),
  brandName: z.string().nullable(),
}) satisfies z.ZodType<ConfirmedValues>;

export const briefRuleSchema = z.object({
  id: z.string(),
  kind: z.enum(["do", "dont"]),
  text: z.string().trim().min(1).max(200),
  source: z.enum(["chat", "rating", "edit"]),
  locked: z.boolean(),
});

export const briefContentSchema = z.object({
  rules: z.array(briefRuleSchema),
  campaign: campaignPatchSchema,
  research: z.array(researchSchema),
  values: confirmedValuesSchema,
  exemplarCreativeIds: z.array(z.string()),
  approvedAngles: z.array(z.string()),
  // Set on the version a round's rewrite created, so a later attempt of the same round reuses it.
  round: z.number().optional(),
});

export type BriefRule = z.infer<typeof briefRuleSchema>;
export type BriefContent = z.infer<typeof briefContentSchema>;
