import { z } from "zod";

export { pageStylesSchema } from "@/lib/providers/snapshot";

export const scrapeResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    rawHtml: z.string(),
    metadata: z.object({ statusCode: z.number().int() }),
    actions: z
      .object({
        javascriptReturns: z.array(z.object({ value: z.unknown() })).optional(),
      })
      .optional(),
  }),
});
