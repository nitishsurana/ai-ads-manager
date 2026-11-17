import { z } from "zod";

const field = z.string().trim().min(1).max(80);

export const campaignPatchSchema = z.object({
  occasion: field.optional(),
  angle: field.optional(),
  audience: field.optional(),
});

export type Campaign = z.infer<typeof campaignPatchSchema>;
