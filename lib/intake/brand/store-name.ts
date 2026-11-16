import type { CheerioAPI } from "cheerio";
import { headerText } from "./header-logo";
import { readOrganisation } from "./structured-data";

export type PageDoc = { $: CheerioAPI; url: string };

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

// "My Store" is Shopify's default; a blank or the bare myshopify subdomain says nothing about the brand.
export function usableName(name: string | null | undefined, host: string) {
  const text = squash(name ?? "");
  if (text === "" || /^my store$/i.test(text)) return null;
  if (host.endsWith(".myshopify.com")) {
    const bare = host.slice(0, -".myshopify.com".length);
    const lowered = text.toLowerCase();
    if (lowered === bare || lowered === host) return null;
  }
  return text;
}

// In order, product page then homepage within each source: the organisation name, og:site_name, then header text.
export function readStoreName(pages: PageDoc[], host: string): string | null {
  const sources: ((page: PageDoc) => string | null | undefined)[] = [
    (page) => readOrganisation(page.$)?.name,
    (page) => page.$('meta[property="og:site_name"]').attr("content"),
    (page) => headerText(page.$, page.url),
  ];
  for (const source of sources) {
    for (const page of pages) {
      const name = usableName(source(page), host);
      if (name) return name;
    }
  }
  return null;
}

// Last resort: the logo's alt text, minus the word "logo".
export function nameFromAlt(alt: string | null, host: string) {
  return usableName(alt?.replace(/\blogo\b/gi, ""), host);
}
