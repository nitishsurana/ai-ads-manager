import { z } from "zod";
import { campaignPatchSchema } from "@/lib/chat/campaign-schema";
import { researchSchema } from "@/lib/chat/types";
import type { ConfirmedValues } from "@/lib/confirm";

export const confirmedValuesSchema = z.object({
  price: z.string().nullable(),
  wasPrice: z.string().nullable(),
  currency: z.string(),
  rating: z.object({ value: z.number(), count: z.number() }).nullable(),
  brandName: z.string().nullable(),
}) satisfies z.ZodType<ConfirmedValues>;

export const MAX_RULES = 20;

export const briefRuleSchema = z.object({
  id: z.string(),
  kind: z.enum(["do", "dont"]),
  text: z.string().trim().min(1).max(200),
  source: z.enum(["chat", "round", "tester_edit"]),
  locked: z.boolean(),
});

export const briefSettingsSchema = z.object({
  productSize: z.enum(["normal", "smaller"]),
  preferCutout: z.boolean(),
  backgroundStyle: z.enum(["any", "plain", "scene"]),
});

export const DEFAULT_SETTINGS = {
  productSize: "normal",
  preferCutout: false,
  backgroundStyle: "any",
} satisfies z.infer<typeof briefSettingsSchema>;

export const briefContentSchema = z.object({
  rules: z.array(briefRuleSchema),
  campaign: campaignPatchSchema,
  research: z.array(researchSchema),
  values: confirmedValuesSchema,
  exemplarCreativeIds: z.array(z.string()),
  approvedAngles: z.array(z.string()),
  settings: briefSettingsSchema.default(DEFAULT_SETTINGS),
  // Set on the version a round's rewrite created, so a later attempt of the same round reuses it.
  round: z.number().optional(),
});

export type BriefSettings = z.infer<typeof briefSettingsSchema>;

export const isDefaultSettings = (settings: BriefSettings) =>
  settings.productSize === DEFAULT_SETTINGS.productSize &&
  settings.preferCutout === DEFAULT_SETTINGS.preferCutout &&
  settings.backgroundStyle === DEFAULT_SETTINGS.backgroundStyle;

export type BriefRule = z.infer<typeof briefRuleSchema>;
export type BriefContent = z.infer<typeof briefContentSchema>;

// A copy of a brief for a non-round version: the round marker names the version a rewrite made.
export function withoutRound(content: BriefContent): BriefContent {
  const copy = { ...content };
  delete copy.round;
  return copy;
}
