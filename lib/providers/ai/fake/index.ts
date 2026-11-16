import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  aiSnapshotSchema,
  readSnapshotJson,
  recordedErrorSchema,
  SnapshotError,
} from "@/lib/providers/snapshot";
import { aiSnapshotKey } from "../key";
import type { Ai } from "../types";

export function createReplayAi(snapshotDir: string): Ai {
  // Loaded on first use: rows that fail before the photos have no ai.json.
  const load = () => {
    if (!existsSync(join(snapshotDir, "ai.json"))) {
      throw new SnapshotError("ai: no ai.json recorded");
    }
    return readSnapshotJson(snapshotDir, "ai.json", aiSnapshotSchema);
  };
  let snapshot: ReturnType<typeof load> | undefined;

  return {
    async generate<T>(request: {
      task: string;
      inputSha256: string;
      model: string;
      system: string;
      prompt: string;
      inputVersion?: string;
      schema: z.ZodType<T>;
    }) {
      snapshot ??= load();
      const key = aiSnapshotKey(request);
      const entry = snapshot[key];
      if (entry === undefined) {
        throw new SnapshotError(`ai: ${key} was not recorded`);
      }
      const failure = recordedErrorSchema.safeParse(entry);
      if (failure.success) throw new Error(failure.data.error);
      const parsed = request.schema.safeParse(entry);
      if (!parsed.success) {
        throw new SnapshotError(`ai: ${key} fails the schema: ${parsed.error}`);
      }
      return { object: parsed.data, costUsd: null };
    },
  };
}
