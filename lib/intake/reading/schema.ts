import { z } from "zod";
import { step1FailureCodes } from "@/lib/messages";

export const readingStatusSchema = z.object({
  status: z.enum(["reading", "failed", "done"]),
  url: z.string(),
  stage: z.enum(["product", "photos", "brand"]),
  phase: z.enum(["reading", "checking"]).nullable(),
  done: z.number().nullable(),
  total: z.number().nullable(),
  product: z
    .object({ title: z.string(), price: z.string().nullable() })
    .nullable(),
  failure: z
    .object({ code: z.enum(step1FailureCodes), message: z.string() })
    .nullable(),
  canRetry: z.boolean(),
  workspaceId: z.string().nullable(),
  photos: z.array(z.object({ position: z.number(), url: z.string() })),
});

export type ReadingStatus = z.infer<typeof readingStatusSchema>;
