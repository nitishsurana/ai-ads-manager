import { z } from "zod";
import type { Box, CtaMode, Layout } from "@/lib/render";
import type { RoundInputs } from "./inputs";
import type { JudgeRecord } from "./judge/schema";

export const STAGES = [
  "writing_copy",
  "making_backgrounds",
  "compositing",
  "checking_quality",
] as const;
export type Stage = (typeof STAGES)[number];

export const ANGLES = [
  "benefit",
  "social_proof",
  "price",
  "offer",
  "lifestyle",
  "feature_close_up",
] as const;
export type Angle = (typeof ANGLES)[number];

export type SupportingElement = "price" | "rating" | "offer";

export type Copy = { eyebrow: string | null; headline: string; cta: string };

// A whole photo (a scene, or a person) has no method for the model to choose. `placement` 2 is the fit-to-width placement; rows without it use the older cover crop. `size` is absent for a normal-size product.
export type Background =
  | { method: "bria"; prompt: string; reason: string; size?: "smaller" }
  | { method: "solid" | "tonal"; reason: string; size?: "smaller" }
  | { method: "photo"; placement?: 2; isolated?: boolean; gaps?: boolean };

// One planned creative, filled in as the stages run. Plain data: it crosses step boundaries.
export type Candidate = {
  index: number;
  angle: Angle;
  photoId: string;
  supportingElement: SupportingElement | null;
  // The confirmed offer a badge shows; set only when supportingElement is "offer".
  offerFactId: string | null;
  background: Background;
  copy: Copy | null;
  // The tester's button colour setting at planning time; absent means "auto".
  ctaColour?: CtaMode;
  backgroundPath: string | null;
  // Where the product sits in the 1080x1920 background.
  product: Box | null;
  layout: Layout | null;
  previewPath: string | null;
  // Set by the judge panel; only candidates that passed Layer 1 have one.
  judge: JudgeRecord | null;
};

export const progressSchema = z.object({
  candidates: z.array(z.object({ n: z.number(), angle: z.enum(ANGLES) })),
  counts: z.partialRecord(
    z.enum(STAGES),
    z.object({ done: z.number(), total: z.number() }),
  ),
});

export type RoundProgress = z.infer<typeof progressSchema>;

// What every stage of a round works from: the ids and the inputs frozen at start.
export type RoundContext = {
  userId: string;
  workspaceId: string;
  roundId: string;
  n: number;
  attempt: number;
  // The brief version the round works from: set at start, replaced by the rewrite step's new version.
  briefVersion: number;
  inputs: RoundInputs;
};
