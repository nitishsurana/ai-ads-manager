import { z } from "zod";
import type { Step1FailureCode } from "@/lib/messages";
import type { CostEntry } from "../photos";

// Everything here crosses step boundaries, so it stays plain data.
export type IntakeRun = {
  userId: string;
  threadId: string;
  intakeId: string;
  url: string;
  deadlineAt: number;
};

export type Spend = { costs: CostEntry[]; firecrawlRenders: string[] };

export type StageResult<T> = Spend &
  (
    | { kind: "ok"; value: T }
    | { kind: "error"; code: Step1FailureCode }
    | { kind: "abandoned" }
  );

export const progressSchema = z.object({
  stage: z.enum(["product", "photos", "brand"]),
  phase: z.enum(["reading", "checking"]).optional(),
  done: z.number().optional(),
  total: z.number().optional(),
  product: z
    .object({ title: z.string(), price: z.string().nullable() })
    .optional(),
  photos: z.array(z.object({ position: z.number(), thumbPath: z.string() })),
});

export type ProgressState = z.infer<typeof progressSchema>;
