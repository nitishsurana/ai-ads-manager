import type { CheerioAPI } from "cheerio";
import { getFollowingRedirects, type Http } from "@/lib/providers/http";
import { logSwallowed } from "./log";
import { absolute } from "./urls";

const MAX_SHEETS = 2;
const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 15_000;
// Theme sheets first: they hold the custom properties; component sheets rarely do.
const THEME_NAME = /theme|base|global|style|main|custom/i;

const isTheme = (href: string) => THEME_NAME.test(new URL(href).pathname);

// Linked stylesheets on the store's own host or Shopify's CDN (app extension sheets skipped), theme-looking ones first.
export function stylesheetUrls($: CheerioAPI, pageUrl: string) {
  const host = new URL(pageUrl).hostname;
  const urls = $('link[rel~="stylesheet"][href]')
    .toArray()
    .flatMap((node) => {
      const href = absolute($(node).attr("href") ?? "", pageUrl);
      const url = href ? URL.parse(href) : null;
      const own = url?.hostname === host;
      const cdn =
        url?.hostname === "cdn.shopify.com" &&
        !url.pathname.startsWith("/extensions/");
      return url && (own || cdn) ? [url.href] : [];
    });
  return [...new Set(urls)]
    .sort((a, b) => Number(isTheme(b)) - Number(isTheme(a)))
    .slice(0, MAX_SHEETS);
}

// The css text of the page's linked theme sheets. A sheet that fails to load is skipped, never fatal.
export async function readLinkedCss(
  $: CheerioAPI,
  pageUrl: string,
  label: string,
  deps: { http: Http },
) {
  const sheets = await Promise.all(
    stylesheetUrls($, pageUrl).map(async (url) => {
      const fetched = await getFollowingRedirects(deps.http, url, {
        maxBytes: MAX_BYTES,
        timeoutMs: TIMEOUT_MS,
      });
      if (!fetched.ok) {
        logSwallowed(label, `stylesheet ${url}`, fetched.reason);
        return "";
      }
      const { status, truncated, body } = fetched.response;
      return status === 200 && !truncated ? body.toString("utf8") : "";
    }),
  );
  return sheets.join("\n");
}
