import type { Market } from "./types";

// Language, optional script (zh-hans), optional region (en-ca, es-419).
const LOCALE = /^[a-z]{2,3}(?:-[a-z]{4})?(?:-([a-z]{2}|\d{3}))?$/i;

const TLD_MARKETS: Record<string, Market> = {
  ca: "CA",
  uk: "GB",
  au: "AU",
  in: "IN",
  de: "DE",
  fr: "FR",
};

const COUNTRY_MARKETS: Record<string, Market> = {
  ca: "CA",
  gb: "GB",
  au: "AU",
  in: "IN",
  de: "DE",
  fr: "FR",
};

function pathSegments(url: URL) {
  return url.pathname.split("/").filter(Boolean);
}

function localeCountry(segment: string | undefined) {
  return segment?.match(LOCALE)?.[1]?.toLowerCase();
}

export function normalHost(url: URL) {
  return url.hostname.toLowerCase().replace(/\.$/, "");
}

// A leading /en-ca/ or /fr/ is only a locale prefix when a /products/ segment follows it.
function stripPrefixes(segments: string[]) {
  const rest = [...segments];
  const first = rest[0];
  if (first && LOCALE.test(first) && rest.includes("products")) rest.shift();
  if (rest[0] === "collections" && rest[2] === "products") rest.splice(0, 2);
  return rest;
}

export function handleOf(url: URL) {
  const [section, handle] = stripPrefixes(pathSegments(url));
  if (section !== "products" || !handle) return null;
  return handle.replace(/\.(json|js)$/i, "").toLowerCase() || null;
}

export function productKeyOf(url: URL) {
  const handle = handleOf(url);
  if (!handle) return null;
  return `${normalHost(url).replace(/^www\./, "")}/products/${handle}`;
}

// An explicit locale country (/en-ca/) wins over the TLD; a language-only prefix says nothing about the market.
export function marketOf(url: URL): Market {
  const country = localeCountry(pathSegments(url)[0]);
  if (country && COUNTRY_MARKETS[country]) return COUNTRY_MARKETS[country];
  const tld = normalHost(url).split(".").at(-1) ?? "";
  return TLD_MARKETS[tld] ?? "US";
}
