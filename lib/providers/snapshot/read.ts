import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";

// A replay or recording problem (nothing recorded, a bad entry, a failed live call while recording); callers must not treat it as a provider failure.
export class SnapshotError extends Error {}

export function sha256(data: Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}

export function readSnapshotJson<T extends z.ZodType>(
  dir: string,
  file: string,
  schema: T,
): z.infer<T> {
  return schema.parse(JSON.parse(readFileSync(join(dir, file), "utf8")));
}

export function readSnapshotBody(dir: string, ref: string) {
  return readFileSync(join(dir, ref));
}
