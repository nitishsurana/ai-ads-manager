import type { CheerioAPI } from "cheerio";
import type { Market } from "../types";
import { currencyOfSymbol, marketCurrency } from "./money";

const CODE = /^[A-Z]{3}$/;

// Read before the section is cleaned: the Shopify currency script can sit inside it.
export function currencySignal($: CheerioAPI) {
  const metas = [
    'meta[property="og:price:currency"]',
    'meta[property="product:price:currency"]',
    'meta[itemprop="priceCurrency"]',
  ].map((selector) => $(selector).attr("content")?.trim().toUpperCase());
  const shopify = $("script")
    .toArray()
    .map(
      (s) =>
        $(s)
          .text()
          .match(/Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/)?.[1],
    )
    .find(Boolean);
  return [...metas, shopify].find((code) => code && CODE.test(code));
}

// What the shopper reads wins, then the page's own signals, then the URL's market.
export function detectCurrency(
  displayedPrice: string | null,
  signal: string | undefined,
  market: Market,
) {
  return (
    (displayedPrice && currencyOfSymbol(displayedPrice)) ||
    signal ||
    marketCurrency(market)
  );
}
