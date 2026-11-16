import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { isHomepageHref } from "./urls";

export type LogoRef =
  | { kind: "url"; href: string; alt: string | null }
  | { kind: "svg"; markup: string; alt: string | null };

const MAX_SCRIPT_CHARS = 2_000_000;
const MAX_USE_PASSES = 3;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

function srcsetLargest(srcset: string) {
  const last = srcset.split(",").at(-1)?.trim().split(/\s+/)[0];
  return last || null;
}

// Lazy-loading themes write data-src="logo_{width}x.png" and fill the width in with JavaScript; a large width gets the full-size file.
const PLACEHOLDER_WIDTH = "2048";

function imageHref(img: Cheerio<AnyNode>) {
  const lazy = img
    .attr("data-src")
    ?.replace(/\{width\}|%7Bwidth%7D/gi, PLACEHOLDER_WIDTH);
  const direct = [lazy, img.attr("src")].find(
    (value) => value && !value.startsWith("data:"),
  );
  return (
    direct ??
    srcsetLargest(img.attr("data-srcset") ?? "") ??
    srcsetLargest(img.attr("srcset") ?? "")
  );
}

function hrefOfUse($: CheerioAPI, use: Cheerio<AnyNode>) {
  return (use.attr("href") ?? use.attr("xlink:href") ?? "").replace(/^#/, "");
}

// <use href="#icon"> points at a <symbol> elsewhere on the page; the symbol's content replaces it so the svg stands alone.
function standaloneSvg($: CheerioAPI, svg: Cheerio<AnyNode>) {
  const copy = cheerio.load($.html(svg), null, false);
  const root = copy("svg").first();
  for (let pass = 0; pass < MAX_USE_PASSES; pass++) {
    const uses = root.find("use");
    if (uses.length === 0) break;
    uses.each((_, el) => {
      const use = copy(el);
      const id = hrefOfUse(copy, use);
      const target = id ? $(`[id="${id.replace(/"/g, "")}"]`).first() : null;
      if (target?.length) {
        const inner = target.is("symbol") ? target.html() : $.html(target);
        const viewBox = target.attr("viewBox");
        if (viewBox && !root.attr("viewBox")) root.attr("viewBox", viewBox);
        use.replaceWith(`<g>${inner ?? ""}</g>`);
      } else use.remove();
    });
  }
  if (!root.attr("xmlns")) root.attr("xmlns", SVG_NAMESPACE);
  const markup = copy.html(root);
  return markup.includes("xlink:") && !markup.includes("xmlns:xlink")
    ? markup.replace("<svg", `<svg xmlns:xlink="${XLINK_NAMESPACE}"`)
    : markup;
}

function altOf($: CheerioAPI, el: Cheerio<AnyNode>) {
  const text =
    el.attr("alt") ?? el.attr("aria-label") ?? el.find("title").first().text();
  return text.trim() || null;
}

function refOfAnchor($: CheerioAPI, anchor: Cheerio<AnyNode>): LogoRef | null {
  for (const node of anchor.find("img, svg").toArray()) {
    const el = $(node);
    if (el.is("img")) {
      const href = imageHref(el);
      if (href) return { kind: "url", href, alt: altOf($, el) };
    } else if (el.parents("svg").length === 0) {
      return { kind: "svg", markup: standaloneSvg($, el), alt: altOf($, el) };
    }
  }
  return null;
}

// The first image or svg inside a link to the homepage, outside the footer: header themes differ, the homepage link doesn't.
function homepageLogo($: CheerioAPI, pageUrl: string): LogoRef | null {
  for (const node of $("a[href]").toArray()) {
    const anchor = $(node);
    if (anchor.closest("footer").length > 0) continue;
    if (!isHomepageHref(anchor.attr("href") ?? "", pageUrl)) continue;
    const ref = refOfAnchor($, anchor);
    if (ref) return ref;
  }
  return null;
}

function unescapeScript(text: string) {
  return text
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\(["'/\\])/g, "$1")
    .replace(/\\[nrt]/g, " ");
}

// Some themes keep the header markup as a string inside a script (G21), so the scripts are searched for the same link.
function scriptHeldLogo($: CheerioAPI, pageUrl: string): LogoRef | null {
  for (const node of $("script:not([src])").toArray()) {
    const script = $(node);
    if (script.attr("type") === "application/ld+json") continue;
    const text = script.html() ?? "";
    if (text.length > MAX_SCRIPT_CHARS || !/<a\s|\\u003ca\s/i.test(text))
      continue;
    const held = cheerio.load(unescapeScript(text));
    const ref = homepageLogo(held, pageUrl);
    if (ref) return ref;
  }
  return null;
}

export function findHeaderLogo($: CheerioAPI, pageUrl: string): LogoRef | null {
  return homepageLogo($, pageUrl) ?? scriptHeldLogo($, pageUrl);
}

// Header text for the store name: the homepage link's own words when it has no image. Only links inside the header count, so an announcement bar that links home can't become the name.
const NAME_CLASS = /logo|brand|site-name|store-name|heading/i;
const HEADER = "header, [role=banner]";
const BAR = '[class*="announcement" i], [id*="announcement" i]';
const GENERIC_TEXT =
  /^(home|homepage|go to homepage|go to home page|skip to content|menu|shop)$/i;

export function headerText($: CheerioAPI, pageUrl: string): string | null {
  const texts = $(`${HEADER}`)
    .find("a[href]")
    .toArray()
    .filter((node) => {
      const anchor = $(node);
      return (
        anchor.closest(BAR).length === 0 &&
        isHomepageHref(anchor.attr("href") ?? "", pageUrl)
      );
    })
    .map((node) => ({
      node,
      text: $(node).text().replace(/\s+/g, " ").trim(),
    }))
    .filter(
      ({ text }) =>
        text !== "" && text.length <= 80 && !GENERIC_TEXT.test(text),
    );
  const named = texts.find(({ node }) =>
    NAME_CLASS.test($(node).attr("class") ?? ""),
  );
  return (named ?? texts[0])?.text ?? null;
}
