import { z } from "zod";

export const birefnetResponseSchema = z.object({
  image: z.object({ url: z.url() }),
});
