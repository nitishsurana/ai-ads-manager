import { captureStylesScript } from "./capture-styles";
import { pageStylesSchema, scrapeResponseSchema } from "./schemas";
import type { Firecrawl } from "./types";

const ENDPOINT = "https://api.firecrawl.dev/v2/scrape";
const CACHE_MAX_AGE_MS = 10 * 60 * 1000;
// Review and quiz widgets hydrate after load; 3 s covers the common ones without making every intake slow.
const WIDGET_WAIT_MS = 3_000;
const SCRAPE_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = SCRAPE_TIMEOUT_MS + 15_000;

export function createRealFirecrawl(): Firecrawl {
  return {
    async scrapePage(url, { country, waitForWidgets, captureStyles }) {
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
          ...((waitForWidgets || captureStyles) && {
            actions: [
              { type: "wait", milliseconds: WIDGET_WAIT_MS },
              ...(captureStyles
                ? [
                    {
                      type: "executeJavascript",
                      script: captureStylesScript(captureStyles.variantIds),
                    },
                  ]
                : []),
            ],
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
        styles: captureStyles ? parseStyles(url, data.actions) : null,
      };
    },
  };
}

// A failed capture costs the page its computed styles, not the intake: the brand stage falls back to the inline CSS.
function parseStyles(
  url: string,
  actions: { javascriptReturns?: { value: unknown }[] } | undefined,
) {
  const value = actions?.javascriptReturns?.[0]?.value;
  try {
    return pageStylesSchema.parse(JSON.parse(String(value)));
  } catch (error) {
    console.error(`firecrawl: style capture for ${url} unusable`, error);
    return null;
  }
}
