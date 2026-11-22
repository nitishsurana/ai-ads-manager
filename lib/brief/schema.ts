import { z } from "zod";
import { campaignPatchSchema } from "@/lib/chat/campaign-schema";
import { researchSchema } from "@/lib/chat/types";
import type { ConfirmedValues } from "@/lib/confirm";
import { CTA_MODES } from "@/lib/render/layout";

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

// What the rewrite returns: no defaults, so the model can't leave a setting out and silently reset it.
export const rewriteSettingsSchema = z.object({
  productSize: z.enum(["normal", "smaller"]),
  backgroundStyle: z.enum(["any", "plain", "scene"]),
  ctaColour: z.enum(CTA_MODES),
});

// Versions stored before the button colour setting have none, which reads as "auto".
export const briefSettingsSchema = rewriteSettingsSchema.extend({
  ctaColour: z.enum(CTA_MODES).default("auto"),
});

export const DEFAULT_SETTINGS = {
  productSize: "normal",
  backgroundStyle: "any",
  ctaColour: "auto",
} satisfies z.infer<typeof briefSettingsSchema>;

export const briefContentSchema = z.object({
  rules: z.array(briefRuleSchema),
  campaign: campaignPatchSchema,
  research: z.array(researchSchema),
  values: confirmedValuesSchema,
  exemplarCreativeIds: z.array(z.string()),
  approvedAngles: z.array(z.string()),
  settings: briefSettingsSchema.default(DEFAULT_SETTINGS),
  // What the tester asked for that only code decides, as the last rewrite put it; shown, never acted on.
  notApplied: z.array(z.string()).default([]),
  // Set on the version a round's rewrite created, so a later attempt of the same round reuses it.
  round: z.number().optional(),
});

export type BriefSettings = z.infer<typeof briefSettingsSchema>;

// The settings the art director's prompt sees; the button colour is applied by code and never reaches it.
export const isDefaultPlannerSettings = (settings: BriefSettings) =>
  settings.productSize === DEFAULT_SETTINGS.productSize &&
  settings.backgroundStyle === DEFAULT_SETTINGS.backgroundStyle;

export type BriefRule = z.infer<typeof briefRuleSchema>;
export type BriefContent = z.infer<typeof briefContentSchema>;

// A copy of a brief for a non-round version: the round marker names the version a rewrite made.
export function withoutRound(content: BriefContent): BriefContent {
  const copy = { ...content };
  delete copy.round;
  return copy;
}

const NOT_APPLIED_CHARS = 100;
const NOT_APPLIED_KEPT = 5;

// The rewrite's list of requests no rule or setting can deliver, kept short enough for one line of the brief panel.
export const cleanNotApplied = (items: string[]) =>
  items
    .map((item) => item.trim().slice(0, NOT_APPLIED_CHARS))
    .filter((item) => item !== "")
    .slice(0, NOT_APPLIED_KEPT);
