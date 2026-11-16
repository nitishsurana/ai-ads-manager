import {
  firecrawlSnapshotSchema,
  readSnapshotBody,
  readSnapshotJson,
  SnapshotError,
} from "@/lib/providers/snapshot";
import type { Firecrawl } from "../types";

export function createReplayFirecrawl(snapshotDir: string): Firecrawl {
  // Loaded on first use: rows that fail before the render have no firecrawl.json.
  const load = () =>
    readSnapshotJson(snapshotDir, "firecrawl.json", firecrawlSnapshotSchema);
  let snapshot: ReturnType<typeof load> | undefined;

  return {
    async scrapePage(url, { country }) {
      snapshot ??= load();
      const entry = snapshot[url];
      if (!entry) throw new SnapshotError(`firecrawl: ${url} was not recorded`);
      if (entry.location !== country) {
        throw new SnapshotError(
          `firecrawl: ${url} was recorded for ${entry.location}, asked for ${country}`,
        );
      }
      return {
        status: entry.status,
        html: readSnapshotBody(snapshotDir, entry.html).toString("utf8"),
        location: entry.location,
        styles: entry.styles ?? null,
      };
    },
  };
}
