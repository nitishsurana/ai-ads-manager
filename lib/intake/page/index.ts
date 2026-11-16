import * as cheerio from "cheerio";
import type { Step1FailureCode } from "@/lib/messages";
import type { ShopifyProduct } from "../product";
import type { Market } from "../types";
import { currencySignal, detectCurrency } from "./currency";
import { jsonLdRating } from "./json-ld";
import { formatAmount, localiseDollar } from "./money";
import { displayedPrice } from "./price";
import { readPurchase } from "./purchase";
import { readRating } from "./rating";
import { mainSection } from "./section";
import type { PageFacts, PurchaseState } from "./types";
import { variantAvailability } from "./variants";

export type {
  PageFacts,
  PageRating,
  PageVariant,
  PurchaseState,
} from "./types";

export function readProductPage(input: {
  html: string;
  product: ShopifyProduct;
  market: Market;
}): PageFacts {
  const { html, product, market } = input;
  const $ = cheerio.load(html);
  // Scripts are read before mainSection strips them from the document.
  const structuredRating = jsonLdRating($, product);
  const signal = currencySignal($);
  const { section, form } = mainSection($, product);

  const variants = variantAvailability($, section, product);
  const purchase = readPurchase(
    $,
    section,
    form,
    product.variants.flatMap((v) => v.options),
  );

  const available = variants.filter((v) => v.availability === "buyable");
  let state: PurchaseState = purchase.state;
  let needsVariantChoice = false;
  if (purchase.chooseOption) {
    const stillUnknown = variants.some((v) => v.availability === "unknown");
    if (available.length > 0) state = "purchasable";
    else if (stillUnknown) needsVariantChoice = true;
    else state = "not_purchasable";
  }

  const shown = displayedPrice($, section);
  const currency = detectCurrency(shown?.price ?? null, signal, market);

  // No price until a variant is chosen: fall back to the first variant that can be bought.
  const fallbackVariant =
    available[0] ??
    variants.find((v) => v.availability === "unknown") ??
    variants[0];
  const fallbackPrice = product.variants.find(
    (v) => v.id === fallbackVariant?.id,
  )?.price;
  const fallbackAmount =
    fallbackPrice === undefined ? null : Number(fallbackPrice);

  return {
    price: shown
      ? localiseDollar(shown.price, currency)
      : fallbackAmount === null
        ? null
        : formatAmount(fallbackAmount, currency),
    priceAmount: shown?.amount ?? fallbackAmount,
    wasPrice: shown?.wasPrice ? localiseDollar(shown.wasPrice, currency) : null,
    currency,
    purchase: state,
    needsVariantChoice,
    variants,
    rating: readRating($, section, structuredRating, product.id),
  };
}

export function pageFailure(page: PageFacts): Step1FailureCode | null {
  if (page.priceAmount === null || page.priceAmount <= 0)
    return "price_missing";
  if (page.purchase === "store_only") return "store_only";
  if (page.purchase === "not_sold_online") return "not_sold_online";
  if (page.purchase === "pre_order") return "pre_order";
  return null;
}
