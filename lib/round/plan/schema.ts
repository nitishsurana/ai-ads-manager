import { z } from "zod";
import { ANGLES } from "../types";

export const planSchema = z.object({
  candidates: z.array(
    z.object({
      angle: z.enum(ANGLES),
      photoId: z.string(),
      element: z.enum(["price", "rating", "offer", "none"]),
      offerFactId: z.string().nullable(),
      background: z.object({
        method: z.enum(["bria", "solid", "tonal"]),
        scenePrompt: z.string().nullable(),
        reason: z.string(),
      }),
    }),
  ),
});

export type RawPlan = z.infer<typeof planSchema>;
