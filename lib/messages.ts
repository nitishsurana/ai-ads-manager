export const messages = {
  wrong_password: "That password isn't right.",
  name_invalid: "Enter your name, up to 40 characters.",

  url_malformed: "That doesn't look like a valid link. Check it and try again.",
  not_shopify: "Only Shopify product pages are supported for now.",
  not_a_product: "Paste a link to a single product page.",
  product_not_found: "We couldn't find that product.",
  store_password: "This store is password-protected, so we can't read it.",
  store_unreachable: "We couldn't reach this store. Try another product.",
  no_photos: "This product has no photos to build ads from.",
  price_missing: "Only products with a price above $0 are supported.",
  store_only:
    "This product is only sold in stores, so we can't make ads for it.",
  not_sold_online:
    "This product can't be bought online, so we can't make ads for it.",
  pre_order:
    "Pre-order products aren't supported yet. Try a product that's available now.",
  intake_failed: "Something went wrong reading this product. Try again.",
  intake_running:
    "I'm still reading the last link. Paste another once it's done.",
  extra_links: "I only read the first link in a message.",
  try_another_link: "Paste a different product link to try again.",
  chat_failed: "Something went wrong with that message. Try again.",
  confirm_locked:
    "A round is still running. Wait for it to finish, then save your changes.",
  save_failed: "We couldn't save that. Try again.",
  cannot_generate: "Finish the items at the top before generating.",
  spend_cap:
    "Today's spend limit for the test has been reached. Try again tomorrow.",

  not_purchasable: "Shoppers can't buy this online right now. Continue anyway?",
  low_resolution: "This photo is low resolution and may look soft.",
  photo_text: "This photo has text on it; photos without text are used first.",
  no_logo:
    "We couldn't find a logo for this store, so these ads won't include one.",
} as const;

export type MessageCode = keyof typeof messages;

export const step1FailureCodes = [
  "url_malformed",
  "not_shopify",
  "not_a_product",
  "product_not_found",
  "store_password",
  "store_unreachable",
  "no_photos",
  "price_missing",
  "store_only",
  "not_sold_online",
  "pre_order",
  "intake_failed",
] as const satisfies readonly MessageCode[];

export type Step1FailureCode = (typeof step1FailureCodes)[number];
