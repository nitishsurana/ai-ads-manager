import type { CheerioAPI } from "cheerio";
import { parseAmount } from "@/lib/money";
import { cleanPrice, PRICE_AT_START } from "./money";
import type { Node, Scope } from "./section";
import { textOf } from "./text";

type PriceNode = {
  token: string;
  amount: number;
  was: boolean;
  sale: boolean;
  subscription: boolean;
  hinted: boolean;
  element: Node;
};

const MAX_PRICE_TEXT = 60;
const NEAR_LEVELS = 4;

const NOT_A_PRICE = "option, select, input, td, th, h1, h2, h3";
const SUBSCRIPTION =
  /subscri|selling-?plan|loop-widget|recharge|autoship|auto-?delivery/i;
const WAS =
  /line-through|strike|compare|(?:^|[\s_-])was(?:[\s_-]|$)|old-?price|original|slashed|crossed|msrp/i;
const PRICE_HINT = /price|money|amount/i;
const SALE = /discount|sale|special|final|current/i;

function nearbyClasses($: CheerioAPI, el: Node, levels: number) {
  const chain = [
    $(el),
    ...$(el)
      .parents()
      .toArray()
      .slice(0, levels)
      .map((p) => $(p)),
  ];
  return chain
    .map((node) => `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`)
    .join(" ");
}

function priceNodes($: CheerioAPI, section: Scope) {
  const nodes: PriceNode[] = [];
  for (const element of section.find("*").toArray()) {
    if ($(element).is(NOT_A_PRICE)) continue;
    const text = textOf(element);
    const token =
      text.length <= MAX_PRICE_TEXT
        ? PRICE_AT_START.exec(text)?.[1]
        : undefined;
    if (!token) continue;
    const rest = text.slice(text.indexOf(token) + token.length);
    if (/^\s*(?:\/|per\b)/i.test(rest)) continue;
    const priceLedChild = $(element)
      .children()
      .toArray()
      .some((child) => PRICE_AT_START.test(textOf(child)));
    if (priceLedChild) continue;

    const classes = nearbyClasses($, element, 2);
    nodes.push({
      token: cleanPrice(token),
      amount: parseAmount(token),
      was: $(element).closest("del, s, strike").length > 0 || WAS.test(classes),
      sale: SALE.test(classes),
      hinted:
        PRICE_HINT.test(classes) ||
        $(element).is("[itemprop=price], [data-price], [data-product-price]"),
      subscription: SUBSCRIPTION.test(nearbyClasses($, element, 8)),
      element,
    });
  }
  return nodes;
}

function isNear($: CheerioAPI, a: PriceNode, b: PriceNode) {
  return $(a.element)
    .parents()
    .toArray()
    .slice(0, NEAR_LEVELS)
    .some((ancestor) => $.contains(ancestor, b.element));
}

export type DisplayedPrice = {
  price: string;
  amount: number;
  wasPrice: string | null;
};

// One-time prices win over subscription ones; a lone subscription price still counts.
export function displayedPrice(
  $: CheerioAPI,
  section: Scope,
): DisplayedPrice | null {
  const all = priceNodes($, section);
  const oneTime = all.filter((n) => !n.subscription);
  const pool = oneTime.length > 0 ? oneTime : all;

  // A node marked as a price beats loose price-led text such as "$10 off your first order".
  const first =
    pool.find((n) => !n.was && n.hinted) ?? pool.find((n) => !n.was);
  if (!first) return null;

  // A shop that marks only the discounted price (no strike-through hint) still puts the higher one beside it.
  const discounted = pool.find(
    (n) => n.sale && n.amount < first.amount && isNear($, first, n),
  );
  const current = discounted ?? first;
  const was = pool.find(
    (n) =>
      (n.was || (discounted !== undefined && n === first)) &&
      n.amount > current.amount &&
      isNear($, current, n),
  );
  return {
    price: current.token,
    amount: current.amount,
    wasPrice: was?.token ?? null,
  };
}
