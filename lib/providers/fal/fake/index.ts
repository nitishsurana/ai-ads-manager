import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  falSnapshotSchema,
  readSnapshotBody,
  readSnapshotJson,
  SnapshotError,
} from "@/lib/providers/snapshot";
import type { Fal } from "../types";

export function createReplayFal(snapshotDir: string): Fal {
  // Loaded on first use: rows with no mask check have no fal.json.
  const load = () => {
    if (!existsSync(join(snapshotDir, "fal.json"))) {
      throw new SnapshotError("fal: no fal.json recorded");
    }
    return readSnapshotJson(snapshotDir, "fal.json", falSnapshotSchema);
  };
  let snapshot: ReturnType<typeof load> | undefined;

  return {
    async backgroundMask({ inputSha256 }) {
      snapshot ??= load();
      const entry = snapshot[inputSha256];
      if (!entry) {
        throw new SnapshotError(
          `fal: mask for ${inputSha256} was not recorded`,
        );
      }
      if (typeof entry !== "string") throw new Error(entry.error);
      return readSnapshotBody(snapshotDir, entry);
    },
  };
}
