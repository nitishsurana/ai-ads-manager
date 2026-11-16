import { createReplayFirecrawl } from "./fake";
import { createRealFirecrawl } from "./real";
import type { Firecrawl } from "./types";

export type {
  Firecrawl,
  FirecrawlPage,
  PageStyles,
  ScrapeOptions,
} from "./types";
export { pageStylesSchema } from "./schemas";
export { createRealFirecrawl };

export function createFirecrawl(
  options: { snapshotDir?: string } = {},
): Firecrawl {
  if (process.env.PROVIDERS !== "fake") return createRealFirecrawl();
  if (!options.snapshotDir) {
    throw new Error("firecrawl: replay needs a snapshotDir");
  }
  return createReplayFirecrawl(options.snapshotDir);
}
