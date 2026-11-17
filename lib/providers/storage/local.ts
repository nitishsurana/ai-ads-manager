import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
    async get(bucket, path) {
      return readFile(join(root, bucket, path)).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      });
    },
    async remove(bucket, paths) {
      await Promise.all(
        paths.map((path) => rm(join(root, bucket, path), { force: true })),
      );
    },
    async removePrefix(bucket, prefix) {
      await rm(join(root, bucket, prefix), { recursive: true, force: true });
    },
  };
}
