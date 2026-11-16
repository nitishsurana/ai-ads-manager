const SHOPIFY_CDN_PATH = /\/cdn\/shop\/|\/s\/files\//;
// "_300x", "_300x300", "_x300", "_large", "_crop_center" and "@2x" before the extension: Shopify serves a resized copy.
const SIZE_SUFFIX =
  /(?:_(?:\d+x\d*|x\d+|pico|icon|thumb|small|compact|medium|large|grande|original|master))?(?:_crop_(?:top|center|bottom|left|right))?(?:@\dx)?(?=\.[a-z0-9]+$)/i;

export function absolute(href: string, base: string): string | null {
  const url = URL.parse(href.trim(), base);
  return url && /^https?:$/.test(url.protocol) ? url.href : null;
}

// The full-size file first, then the URL as the page wrote it, in case the stripped name doesn't exist.
export function logoUrls(href: string, base: string): string[] {
  const given = absolute(href, base);
  if (!given) return [];
  const url = new URL(given);
  if (
    !SHOPIFY_CDN_PATH.test(url.pathname) &&
    !url.hostname.endsWith("shopify.com")
  ) {
    return [given];
  }
  const full = new URL(url.origin + url.pathname.replace(SIZE_SUFFIX, ""));
  return [...new Set([full.href, given])];
}

export function sameSite(a: URL, b: URL) {
  const bare = (host: string) => host.replace(/^www\./, "");
  return bare(a.hostname) === bare(b.hostname);
}

// "/", "/en-ca" and "/fr/": the store's homepage, with or without a market prefix.
export function isHomepageHref(href: string, base: string) {
  const url = URL.parse(href.trim(), base);
  const page = URL.parse(base);
  if (!url || !page || !/^https?:$/.test(url.protocol)) return false;
  return (
    sameSite(url, page) &&
    /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/?)?$/i.test(url.pathname)
  );
}
