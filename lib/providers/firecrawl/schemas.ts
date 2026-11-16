import { z } from "zod";

export const scrapeResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    rawHtml: z.string(),
    metadata: z.object({ statusCode: z.number().int() }),
  }),
});
