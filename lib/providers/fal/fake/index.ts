import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  falSnapshotSchema,
  readSnapshotBody,
  readSnapshotJson,
  SnapshotError,
} from "@/lib/providers/snapshot";
import type { Fal } from "../types";

type Snapshot = ReturnType<typeof falSnapshotSchema.parse>;

// Rows with no mask check have no fal.json, so a folder is read on first use. Several folders are searched in order: a round's own recording first, then step 1's.
export function createReplayFal(...snapshotDirs: string[]): Fal {
  let loaded: { dir: string; snapshot: Snapshot }[] | undefined;
  const load = () =>
    (loaded ??= snapshotDirs
      .filter((dir) => existsSync(join(dir, "fal.json")))
      .map((dir) => ({
        dir,
        snapshot: readSnapshotJson(dir, "fal.json", falSnapshotSchema),
      })));

  function find(key: string, what: string) {
    for (const { dir, snapshot } of load()) {
      const entry = snapshot[key];
      if (entry === undefined) continue;
      if (typeof entry !== "string") throw new Error(entry.error);
      return readSnapshotBody(dir, entry);
    }
    throw new SnapshotError(`fal: ${what} ${key} was not recorded`);
  }

  return {
    async backgroundMask({ inputSha256 }) {
      return find(inputSha256, "mask for");
    },
    async backgroundEdit({ inputSha256 }) {
      return find(editSnapshotKey(inputSha256), "edit");
    },
  };
}

export const editSnapshotKey = (inputSha256: string) => `bria:${inputSha256}`;
