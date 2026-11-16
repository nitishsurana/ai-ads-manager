import { z } from "zod";

export const caseSchema = z.object({
  url: z.string(),
  location: z.string(),
});

export const dnsSnapshotSchema = z.record(
  z.string(),
  z.union([z.literal("ENOTFOUND"), z.array(z.string())]),
);

const recordedResponse = z.object({
  status: z.number().int(),
  headers: z.record(z.string(), z.string()),
  location: z.string().nullable(),
  body: z.string().nullable(),
  truncated: z.boolean().default(false),
});

const recordedFailure = z.object({ failure: z.enum(["timeout", "network"]) });

export const httpSnapshotSchema = z.record(
  z.string(),
  z.union([recordedResponse, recordedFailure]),
);

export type CaseSnapshot = z.infer<typeof caseSchema>;
