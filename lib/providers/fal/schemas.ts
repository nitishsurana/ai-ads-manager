import { z } from "zod";

export const birefnetResponseSchema = z.object({
  image: z.object({ url: z.url() }),
});

export const briaResponseSchema = z.object({
  images: z.array(z.object({ url: z.url() })).min(1),
});
