import type { IntakeFailure } from "./types";

// The brand label must sit directly before a public suffix, so amazon.myshopify.com is not a marketplace.
const MARKETPLACE =
  /(^|\.)(etsy|amazon|ebay|walmart)\.(com|(co|com)\.[a-z]{2}|[a-z]{2})$/;

export function isMarketplace(host: string) {
  return MARKETPLACE.test(host.replace(/\.$/, ""));
}

export function checkUrl(
  input: string,
): { ok: true; url: URL } | IntakeFailure {
  const trimmed = input.trim();
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = URL.parse(candidate);

  const schemeOk = url?.protocol === "https:" || url?.protocol === "http:";
  const hostOk =
    url && (url.hostname.includes(".") || url.hostname.startsWith("["));
  if (!url || !schemeOk || !hostOk || url.username || url.password) {
    return { ok: false, code: "url_malformed" };
  }
  if (isMarketplace(url.hostname)) return { ok: false, code: "not_shopify" };
  return { ok: true, url };
}
