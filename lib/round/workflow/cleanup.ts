import "server-only";
import type { RoundFile } from "../files";
import { createStorage } from "./deps";

const BUCKETS = ["backgrounds", "previews"] as const;

// Storage is cleared by listing the round's prefix, since a thrown stage carries no paths.
export async function removeRoundFiles(roundId: string) {
  const storage = createStorage();
  await Promise.all(
    BUCKETS.map((bucket) => storage.removePrefix(bucket, roundId)),
  );
}

export async function removeFiles(files: RoundFile[]) {
  const storage = createStorage();
  await Promise.all(
    BUCKETS.map((bucket) => {
      const paths = files
        .filter((file) => file.bucket === bucket)
        .map((file) => file.path);
      return paths.length > 0 ? storage.remove(bucket, paths) : undefined;
    }),
  );
}
