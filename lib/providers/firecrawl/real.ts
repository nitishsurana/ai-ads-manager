import { scrapeResponseSchema } from "./schemas";
import type { Firecrawl } from "./types";

const ENDPOINT = "https://api.firecrawl.dev/v2/scrape";
const CACHE_MAX_AGE_MS = 10 * 60 * 1000;
// Review and quiz widgets hydrate after load; 3 s covers the common ones without making every intake slow.
const WIDGET_WAIT_MS = 3_000;
const SCRAPE_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = SCRAPE_TIMEOUT_MS + 15_000;

export function createRealFirecrawl(): Firecrawl {
  return {
    async scrapePage(url, { country, waitForWidgets }) {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) throw new Error("firecrawl: FIRECRAWL_API_KEY is not set");

      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["rawHtml"],
          blockAds: false,
          maxAge: CACHE_MAX_AGE_MS,
          timeout: SCRAPE_TIMEOUT_MS,
          location: { country },
          ...(waitForWidgets && {
            actions: [{ type: "wait", milliseconds: WIDGET_WAIT_MS }],
          }),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(
          `firecrawl: scrape of ${url} returned ${response.status}`,
        );
      }

      const { data } = scrapeResponseSchema.parse(await response.json());
      return {
        status: data.metadata.statusCode,
        html: data.rawHtml,
        location: country,
      };
    },
  };
}
