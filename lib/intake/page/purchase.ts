import type { CheerioAPI } from "cheerio";
import type { Node, Scope } from "./section";
import { normalise, textOf } from "./text";
import type { PurchaseState } from "./types";

type Group =
  | Exclude<PurchaseState, "purchasable" | "not_purchasable">
  | "cant_buy"
  | "choose"
  | "buy";

const CONTROLS =
  'button, input[type="submit"], input[type="button"], a[role="button"], a[class*="btn" i], a[class*="button" i]';
const QUICK_CHECKOUT =
  '.shopify-payment-button, shopify-accelerated-checkout, shopify-buy-it-now-button, shop-pay-wallet-button, [data-shopify="payment-button"]';
const PRICE_TEXT =
  /(?:[A-Z]{0,3}[$€£₹]\s?\d[\d.,]*|Rs\.?\s?\d[\d.,]*|\d[\d.,]*\s?[€£₹])/g;

// Order matters: "pre-order" and "find in store" must win over the generic buy and notify words.
const GROUPS: [Group, RegExp][] = [
  ["pre_order", /\bpre ?order/],
  [
    "store_only",
    /\bfind (?:it )?in (?:a )?store|\bfind a store|\bcheck (?:in )?store|\bin ?store only|\bstore (?:locator|availability)/,
  ],
  [
    "not_sold_online",
    /\brequest a (?:quote|quotation)|\bget a quote|\bcontact us|\benquire|\binquire|\benquiry|\binquiry/,
  ],
  [
    "cant_buy",
    /\bsold ?out|\bout of stock|\bunavailable|\bnotify|\bwait ?list|\bcoming soon|\bemail me|\bback in stock/,
  ],
  [
    "choose",
    /^(?:select|choose|pick)\b.*\b(?:size|options?|variant|colou?r|style|flavou?r|type|length|width|scent|shade)\b/,
  ],
  ["buy", /^(?:add to (?:cart|bag|basket|trolley)|buy|order|purchase)\b/],
];

function labelOf($: CheerioAPI, el: Node) {
  const node = $(el);
  const raw = textOf(el) || node.attr("value") || node.attr("aria-label") || "";
  return normalise(raw.replace(PRICE_TEXT, " "));
}

function groupOf(label: string) {
  return GROUPS.find(([, pattern]) => pattern.test(label))?.[0];
}

function isEnabled($: CheerioAPI, el: Node) {
  return !$(el).is("[disabled]") && $(el).attr("aria-disabled") !== "true";
}

function isSubmit($: CheerioAPI, el: Node) {
  const type = $(el).attr("type");
  return type === "submit" || (type === undefined && $(el).is("button"));
}

export type Purchase = {
  state: PurchaseState;
  chooseOption: boolean;
};

function firstGroup($: CheerioAPI, controls: Node[]) {
  return controls
    .map((el) => groupOf(labelOf($, el)))
    .find((g) => g !== undefined);
}

// Wallet buttons only count when they can be pressed: a disabled one inside the wrapper means no quick checkout.
function quickCheckoutShows($: CheerioAPI, section: Scope) {
  return section
    .find(QUICK_CHECKOUT)
    .toArray()
    .some((wrapper) => {
      if (!$(wrapper).is(".shopify-payment-button, [data-shopify]")) {
        return isEnabled($, wrapper);
      }
      return $(wrapper)
        .find('button, [role="button"], a')
        .toArray()
        .some((button) => isEnabled($, button));
    });
}

// Buttons placed outside the form but attached to it with form="<id>" still belong to it.
function formControls($: CheerioAPI, form: Scope) {
  const formId = form.attr("id");
  const attached = formId
    ? $("button[form], input[form]")
        .toArray()
        .filter((el) => $(el).attr("form") === formId)
    : [];
  return [...form.find(CONTROLS).toArray(), ...attached];
}

// Submit buttons speak first, then other buttons, then links styled as buttons. With a cart form only its own controls count; without one, the whole section's do.
export function readPurchase(
  $: CheerioAPI,
  section: Scope,
  form: Scope | null,
  optionValues: string[],
): Purchase {
  const controls = form
    ? formControls($, form)
    : section.find(CONTROLS).toArray();
  const links = controls.filter((el) => $(el).is("a"));
  const buttons = controls.filter((el) => !$(el).is("a"));
  const submits = buttons.filter((el) => isSubmit($, el));
  // Variant pills ("L - Sold out") describe one variant, not the product's purchase button.
  const pills = new Set(optionValues.map(normalise));
  const isPill = (el: Node) => {
    const text = normalise(textOf(el));
    return [...pills].some((v) => text === v || text.startsWith(`${v} `));
  };
  const group =
    firstGroup($, submits) ??
    firstGroup(
      $,
      buttons.filter((el) => !isSubmit($, el) && !isPill(el)),
    ) ??
    firstGroup($, links);

  if (
    group === "pre_order" ||
    group === "store_only" ||
    group === "not_sold_online"
  ) {
    return { state: group, chooseOption: false };
  }
  if (group === "cant_buy")
    return { state: "not_purchasable", chooseOption: false };
  if (group === "choose") return { state: "purchasable", chooseOption: true };
  if (group === "buy") return { state: "purchasable", chooseOption: false };

  // An unlisted label is judged by this product's cart form only.
  const addButton = form ? submits[0] : undefined;
  const enabled = addButton !== undefined && isEnabled($, addButton);
  return {
    state:
      enabled || quickCheckoutShows($, section)
        ? "purchasable"
        : "not_purchasable",
    chooseOption: false,
  };
}
