import * as cheerio from "cheerio";
import type { Firecrawl } from "@/lib/providers/firecrawl";
import type { Market } from "../types";
import { logSwallowed } from "./log";
import type { PageDoc } from "./store-name";
import { absolute, sameSite } from "./urls";

const ABOUT_PATH = /(?:^|\/)pages\/(?:about|about-us|our-story|story)\/?$/i;
const MARKET_PREFIX = /^\/([a-z]{2}(?:-[a-z]{2})?)\/products\//i;

export type RenderedPage = PageDoc & { html: string };

function homepageUrl(productUrl: string) {
  const url = new URL(productUrl);
  const prefix = MARKET_PREFIX.exec(url.pathname)?.[1];
  return `${url.origin}/${prefix ? `${prefix}/` : ""}`;
}

// The first link on the homepage, in the nav or the footer, to an about or story page.
function aboutUrl($: cheerio.CheerioAPI, homepage: string) {
  for (const node of $("a[href]").toArray()) {
    const url = URL.parse(absolute($(node).attr("href") ?? "", homepage) ?? "");
    if (
      url &&
      sameSite(url, new URL(homepage)) &&
      ABOUT_PATH.test(url.pathname)
    ) {
      return `${url.origin}${url.pathname}`;
    }
  }
  return null;
}

// The homepage is needed (a failure is retryable); a dead about link just means one page less.
export async function renderBrandPages(
  input: { productUrl: string; market: Market; label: string },
  deps: { firecrawl: Firecrawl },
): Promise<{ homepage: RenderedPage; about: RenderedPage | null }> {
  const options = { country: input.market, waitForWidgets: false };
  const homepageHref = homepageUrl(input.productUrl);
  const home = await deps.firecrawl.scrapePage(homepageHref, options);
  if (home.status >= 400) {
    throw new Error(`Homepage ${homepageHref} returned ${home.status}`);
  }
  const homepage = {
    html: home.html,
    $: cheerio.load(home.html),
    url: homepageHref,
  };

  const aboutHref = aboutUrl(homepage.$, homepageHref);
  if (!aboutHref) return { homepage, about: null };
  const page = await deps.firecrawl.scrapePage(aboutHref, options);
  if (page.status >= 400) {
    logSwallowed(input.label, `about page ${aboutHref}`, `HTTP ${page.status}`);
    return { homepage, about: null };
  }
  return {
    homepage,
    about: { html: page.html, $: cheerio.load(page.html), url: aboutHref },
  };
}
