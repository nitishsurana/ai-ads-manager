import { z } from "zod";
import { ANGLES, STAGES } from "./types";

export const roundStatusSchema = z.object({
  id: z.string(),
  campaign: z.string(),
  n: z.number(),
  attempt: z.number(),
  status: z.enum([
    "queued",
    "running",
    "done",
    "failed",
    "timed_out",
    "no_pass",
  ]),
  stage: z.enum(STAGES).nullable(),
  counts: z.partialRecord(
    z.enum(STAGES),
    z.object({ done: z.number(), total: z.number() }),
  ),
  // The first three planned candidates, for the skeleton tiles.
  candidates: z.array(z.object({ n: z.number(), angle: z.enum(ANGLES) })),
  message: z.string().nullable(),
  runningAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  retryAt: z.string().nullable(),
});

export type RoundStatusView = z.infer<typeof roundStatusSchema>;
