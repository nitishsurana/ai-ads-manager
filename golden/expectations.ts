import { readFileSync } from "node:fs";
import { z } from "zod";

const expectationSchema = z.strictObject({
  message: z.string().nullable(),
  existingWorkspaceId: z.string().optional(),
  existingWorkspaces: z.record(z.string(), z.string()).optional(),
  productKey: z.string().optional(),
  finalUrl: z.string().optional(),
  market: z.string().optional(),
});

export type Expectation = z.infer<typeof expectationSchema>;

export function loadExpectations() {
  const raw: unknown = JSON.parse(
    readFileSync("golden/expectations.json", "utf8"),
  );
  return z.record(z.string(), expectationSchema).parse(raw);
}
