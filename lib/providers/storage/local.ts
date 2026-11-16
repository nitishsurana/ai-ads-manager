import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Storage } from "./types";

// For the golden runner and recorder: files go under a caller-chosen folder, never the repo.
export function createLocalStorage(root: string): Storage {
  return {
    async put(bucket, path, bytes) {
      const file = join(root, bucket, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, bytes);
    },
    async remove(bucket, paths) {
      await Promise.all(
        paths.map((path) => rm(join(root, bucket, path), { force: true })),
      );
    },
  };
}
