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

export const firecrawlSnapshotSchema = z.record(
  z.string(),
  z.object({
    status: z.number().int(),
    html: z.string(),
    location: z.string(),
  }),
);

// Structured model outputs, keyed "<task>:<settings hash>:<sha256 of input>" (see aiSnapshotKey); each is validated against the caller's schema on replay.
export const aiSnapshotSchema = z.record(z.string(), z.unknown());

// A recorded provider failure replays as a thrown error.
export const recordedErrorSchema = z.strictObject({ error: z.string() });

// Mask image bodies keyed by the sha256 of the photo they were made from.
export const falSnapshotSchema = z.record(
  z.string(),
  z.union([z.string(), recordedErrorSchema]),
);

export type CaseSnapshot = z.infer<typeof caseSchema>;
