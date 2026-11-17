import { z } from "zod";
import type { RoundInputs } from "./inputs";

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

// One planned creative, filled in as the stages run. Plain data: it crosses step boundaries.
export type Candidate = {
  index: number;
  angle: Angle;
  photoId: string;
  supportingElement: SupportingElement | null;
  background: { method: "stub" };
  copy: Copy | null;
  backgroundPath: string | null;
  previewPath: string | null;
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
