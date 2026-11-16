import type { CheerioAPI } from "cheerio";
import type { JsonLdRating } from "./json-ld";
import { NOISE, type Node, type Scope } from "./section";
import { squash, textOf } from "./text";
import type { PageRating } from "./types";

type Reading = { value?: number; count?: number; zero: boolean };

// A name must start at a word edge, so "preview" and "operating" don't pass for "review" and "rating".
const WIDGET =
  /(?:^|[^a-z])(?:rating|review|stars?(?!t)|jdgm|stamped|yotpo|oke-|loox|jm-)/i;
const STAR = /(?:^|[^a-z])stars?(?!t)/i;
const MAX_WIDGET_TEXT = 300;

const toNumber = (text: string) => Number(text.replace(/,/g, ""));

function parse(text: string, className = ""): Reading {
  const value =
    text.match(/(\d(?:\.\d+)?)\s*(?:stars?\s*)?(?:out of|\/)\s*5\b/i)?.[1] ??
    text.match(/^(\d\.\d{1,2})\b/)?.[1];
  const count =
    text.match(/(\d[\d,]*)\+?\s*(?:reviews?|ratings?)\b/i)?.[1] ??
    text.match(/\bbased on\s+(\d[\d,]*)/i)?.[1] ??
    text.match(/stars?\s+\(?(\d[\d,]*)\)?(?!\s*(?:out|\/))/i)?.[1] ??
    text.match(/\((\d[\d,]*)\)/)?.[1] ??
    (/^\d[\d,]*$/.test(text) ? text : undefined);
  return {
    value: value === undefined ? undefined : Number(value),
    count: count === undefined ? undefined : toNumber(count),
    zero:
      /\b(?:no (?:reviews?|ratings?)|0 (?:reviews?|ratings?)|be the first)\b/i.test(
        text,
      ) || /no-?reviews?/i.test(className),
  };
}

function ariaLabels($: CheerioAPI, el: Node) {
  const own = $(el).attr("aria-label");
  const inner = $(el)
    .find("[aria-label]")
    .toArray()
    .map((child) => $(child).attr("aria-label"));
  return squash([own, ...inner].filter(Boolean).join(" "));
}

function classesOf($: CheerioAPI, el: Node) {
  return [
    $(el).attr("class"),
    ...$(el)
      .find("[class]")
      .toArray()
      .map((c) => $(c).attr("class")),
  ]
    .filter(Boolean)
    .join(" ");
}

function hasStars($: CheerioAPI, el: Node) {
  const node = $(el);
  return (
    node.find("svg").length > 0 ||
    STAR.test(node.attr("class") ?? "") ||
    node
      .find("[class]")
      .toArray()
      .some((child) => STAR.test($(child).attr("class") ?? ""))
  );
}

// A widget root made only of stars, with no number or review word anywhere in it, is an empty one: zero reviews.
function isEmptyStars(
  $: CheerioAPI,
  el: Node,
  seenText: string,
  ariaText: string,
) {
  const isRoot = $(el)
    .parents()
    .toArray()
    .every((p) => !WIDGET.test($(p).attr("class") ?? ""));
  return (
    isRoot &&
    hasStars($, el) &&
    !/\d|review|rating/i.test(`${seenText} ${ariaText}`)
  );
}

function readingOf(
  $: CheerioAPI,
  el: Node,
  detectEmpty: boolean,
): Reading | null {
  const attrs = [
    $(el).attr("class"),
    $(el).attr("id"),
    $(el).attr("itemprop"),
    $(el).attr("aria-label"),
  ].join(" ");
  if (!WIDGET.test(attrs)) return null;
  const text = textOf(el);
  // A whole review list is too long to read as a summary; its own aria-label still can be.
  const long = text.length > MAX_WIDGET_TEXT;
  if (long && !$(el).attr("aria-label")) return null;
  const seen = long ? parse("") : parse(text, classesOf($, el));
  const ariaText = long ? ($(el).attr("aria-label") ?? "") : ariaLabels($, el);
  const aria = parse(ariaText);
  return {
    value: seen.value ?? aria.value,
    count: seen.count ?? aria.count,
    zero:
      seen.zero ||
      aria.zero ||
      (detectEmpty && !long && isEmptyStars($, el, text, ariaText)),
  };
}

const complete = (r: Reading) => r.value !== undefined && r.count !== undefined;
const informative = (r: Reading) =>
  r.zero || r.count !== undefined || r.value !== undefined;

// A zero reading that comes first is the product's own widget; later numbers belong to other blocks.
function pick(readings: Reading[]): Reading | null {
  const first = readings.find(informative);
  if (first?.zero) return first;
  return readings.find(complete) ?? first ?? null;
}

// The first star widget in the product section that says anything decides; what the shopper reads beats the aria-label.
function sectionReading($: CheerioAPI, section: Scope): Reading | null {
  return pick(
    section
      .find("*")
      .toArray()
      .map((el) => readingOf($, el, true))
      .filter((r): r is Reading => r !== null),
  );
}

const OKENDO_ID = "data-oke-reviews-product-id";
const PRODUCT_ID_ATTRIBUTES = [
  OKENDO_ID,
  "data-product-id",
  "data-productid",
  "data-yotpo-product-id",
  "data-id",
];
// Only a root that is itself a review app's widget can claim a product; a rail or banner wrapper tagged with the id can't.
const REVIEW_APP = /(?:^|[^a-z])(?:jdgm|oke-|okendo|yotpo|stamped|loox)/i;
const PRODUCT_LIKE = /^(?:shopify-)?\d+$|\/\d+$/;

// Apps write the id bare ("123"), prefixed ("shopify-123") or as a gid; compared as values, never placed in a selector.
function isProductId(value: string | undefined, id: number) {
  return (
    value !== undefined &&
    (value === String(id) ||
      value === `shopify-${id}` ||
      value.endsWith(`/${id}`))
  );
}

function isReviewWidgetFor($: CheerioAPI, root: Node, id: number) {
  const tagged = PRODUCT_ID_ATTRIBUTES.some((name) =>
    isProductId($(root).attr(name), id),
  );
  const own = `${$(root).attr("class") ?? ""} ${$(root).attr("id") ?? ""}`;
  return (
    tagged && ($(root).attr(OKENDO_ID) !== undefined || REVIEW_APP.test(own))
  );
}

// The ancestors of a node up to (excluding) the body, itself included.
function inNoise($: CheerioAPI, el: Node) {
  for (
    let node: Node | null = el;
    node && !(node.type === "tag" && node.name === "body");
    node = node.parent
  ) {
    if ($(node).is(NOISE)) return true;
  }
  return false;
}

function isOtherProduct($: CheerioAPI, el: Node, id: number) {
  return PRODUCT_ID_ATTRIBUTES.some((name) => {
    const value = $(el).attr(name);
    return (
      value !== undefined && PRODUCT_LIKE.test(value) && !isProductId(value, id)
    );
  });
}

// Review apps often mount their widget in a section of its own, tagged with the product it belongs to.
// A pruned copy is read so that noise and other products' blocks inside the root can't leak through its text.
function widgetReading($: CheerioAPI, productId: number): Reading | null {
  const readings: Reading[] = [];
  for (const root of $("*").toArray()) {
    if (!isReviewWidgetFor($, root, productId) || inNoise($, root)) continue;
    const copy = $(root).clone();
    copy.find(NOISE).remove();
    copy
      .find("*")
      .filter((_, el) => isOtherProduct($, el, productId))
      .remove();
    for (const el of [copy[0], ...copy.find("*").toArray()]) {
      const reading = el && readingOf($, el, false);
      if (reading) readings.push(reading);
    }
  }
  return pick(readings);
}

// A count with no number beside it is confirmed by the product's own widget when the counts agree.
function visibleRating(
  $: CheerioAPI,
  section: Scope,
  productId: number,
): Reading | null {
  const main = sectionReading($, section);
  if (main?.zero || (main && complete(main))) return main;
  const widget = widgetReading($, productId);
  if (!main) return widget;
  const agrees =
    widget !== null &&
    complete(widget) &&
    (main.count === undefined || main.count === widget.count) &&
    (main.value === undefined || main.value === widget.value);
  return agrees ? widget : main;
}

const SHOW_MIN_VALUE = 4.0;
const SHOW_MIN_COUNT = 20;

function resolve(
  visible: Reading | null,
  structured: JsonLdRating | null,
): { value: number; count: number } | null {
  if (visible === null) return structured;
  if (visible.zero || visible.count === 0 || visible.value === 0) return null;
  if (visible.value !== undefined && visible.count !== undefined) {
    return { value: visible.value, count: visible.count };
  }
  // Stars or a count with no number beside them: structured data only counts when it agrees with what is shown.
  const agrees =
    structured !== null &&
    (visible.count === undefined || visible.count === structured.count) &&
    (visible.value === undefined || visible.value === structured.value);
  return agrees ? structured : null;
}

export function readRating(
  $: CheerioAPI,
  section: Scope,
  structured: JsonLdRating | null,
  productId: number,
): PageRating | null {
  const found = resolve(visibleRating($, section, productId), structured);
  if (!found || found.value <= 0 || found.value > 5 || found.count <= 0) {
    return null;
  }
  const value = Math.round(found.value * 10) / 10;
  return {
    value,
    count: found.count,
    show: value >= SHOW_MIN_VALUE && found.count >= SHOW_MIN_COUNT,
  };
}
