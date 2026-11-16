import { z } from "zod";

const text = z.string().nullable();

// What capture-styles.ts returns: computed CSS strings (rgb(...) colours, font-family stacks), null where the page has no such element.
export const pageStylesSchema = z.object({
  button: z
    .object({ background: text, color: text, fontFamily: text })
    .nullable(),
  header: z.object({ background: text }).nullable(),
  title: z.object({ color: text, fontFamily: text }).nullable(),
  body: z.object({ color: text, fontFamily: text, background: text }),
  link: z.object({ color: text }).nullable(),
});

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
    // Computed styles captured with the page; absent on pages recorded before the capture.
    styles: pageStylesSchema.nullable().optional(),
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
