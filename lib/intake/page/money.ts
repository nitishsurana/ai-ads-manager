import type { Market } from "../types";

const PREFIXED = String.raw`(?:[A-Z]{1,3})?[$€£₹]\s?\d[\d.,]*|Rs\.?\s?\d[\d.,]*`;
const SUFFIXED = String.raw`\d[\d.,]*\s?[€£₹]`;

// The first price in a text, as the page prints it; a trailing currency code is simply not part of the match.
export const PRICE_AT_START = new RegExp(
  String.raw`^(?:from\s+)?(${PREFIXED}|${SUFFIXED})`,
  "i",
);

const SYMBOL_CURRENCIES: Record<string, string> = {
  CA$: "CAD",
  C$: "CAD",
  US$: "USD",
  A$: "AUD",
  AU$: "AUD",
  NZ$: "NZD",
  "£": "GBP",
  "€": "EUR",
  "₹": "INR",
  "Rs.": "INR",
  Rs: "INR",
};

const MARKET_CURRENCIES: Record<Market, string> = {
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  AU: "AUD",
  IN: "INR",
  DE: "EUR",
  FR: "EUR",
};

export function cleanPrice(token: string) {
  return token.trim().replace(/[.,]+$/, "");
}

// Only symbols that name one currency; a bare "$" says nothing on its own.
export function currencyOfSymbol(token: string) {
  const symbol = token
    .match(/^([A-Z]{0,3}[$€£₹])|([€£₹])$/)
    ?.slice(1)
    .find(Boolean);
  return symbol ? SYMBOL_CURRENCIES[symbol] : undefined;
}

export function marketCurrency(market: Market) {
  return MARKET_CURRENCIES[market];
}

// A bare "$" on a non-USD page is that currency's dollar: swap in its distinct symbol and keep the page's digits.
export function localiseDollar(token: string, currency: string) {
  if (currency === "USD" || !token.startsWith("$")) return token;
  const symbol = new Intl.NumberFormat("en-US", { style: "currency", currency })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value;
  // Without a distinct symbol Intl falls back to the ISO code, which the page never printed.
  return symbol && symbol !== currency && symbol !== "$"
    ? `${symbol}${token.slice(1)}`
    : token;
}
