import { z } from "zod";

export const copySchema = z.object({
  candidates: z.array(
    z.object({
      index: z.number().int(),
      eyebrow: z.string().nullable(),
      headline: z.string(),
      cta: z.string(),
    }),
  ),
});

export type RawCopy = z.infer<typeof copySchema>;
