import * as cheerio from "cheerio";

const NOISE = "script, style, noscript, template, svg, iframe, [hidden]";

// Visible words of a page, whitespace squashed and capped: the brand-kit copy is written from these.
export function pageText(html: string, maxChars: number) {
  const $ = cheerio.load(html);
  $(NOISE).remove();
  const root = $("main").length > 0 ? $("main").first() : $("body");
  return root.text().replace(/\s+/g, " ").trim().slice(0, maxChars);
}
