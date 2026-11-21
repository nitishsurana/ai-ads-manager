export const messages = {
  wrong_password: "That password isn't right.",
  name_invalid: "Enter your name, up to 40 characters.",

  url_malformed: "That doesn't look like a valid link. Check it and try again.",
  not_shopify: "Only Shopify product pages are supported for now.",
  not_a_product: "Paste a link to a single product page.",
  product_not_found: "We couldn't find that product.",
  store_password: "This store is password-protected, so we can't read it.",
  store_unreachable: "We couldn't reach this store.",
  no_photos: "This product has no photos to build ads from.",
  price_missing: "Only products with a price above $0 are supported.",
  store_only:
    "This product is only sold in stores, so we can't make ads for it.",
  not_sold_online:
    "This product can't be bought online, so we can't make ads for it.",
  pre_order:
    "Pre-order products aren't supported yet. Try a product that's available now.",
  intake_failed: "Something went wrong reading this product. Try again.",
  page_unreadable:
    "We couldn't load this product page. The store may be blocking automated visits or responded too slowly.",
  brand_failed: "We couldn't build this store's brand kit.",
  intake_timed_out: "Reading this product took too long or stopped responding.",
  photos_unreadable: "We couldn't read any of this product's photos.",
  photo_check_down:
    "Our photo check isn't responding right now, so no photos could be checked.",
  intake_running:
    "I'm still reading the last link. Paste another once it's done.",
  extra_links: "I only read the first link in a message.",
  try_another_link: "Paste a different product link to try again.",
  retry_note: "Paste the link again to retry, or try a different product.",
  retry_failed:
    "We couldn't start another try. Paste the link in the chat instead.",
  chat_failed: "Something went wrong with that message. Try again.",
  confirm_locked:
    "A round is still running. Wait for it to finish, then save your changes.",
  save_failed: "We couldn't save that. Try again.",
  cannot_generate: "Finish the items at the top before generating.",
  spend_cap:
    "Today's spend limit for the test has been reached. Try again tomorrow.",
  daily_limit: "You've reached today's limit of 20 rounds. Try again tomorrow.",
  unrated_creatives: "Rate every creative before starting the next round.",
  round_failed: "Something went wrong making this round. Try again.",
  round_timed_out: "This is taking too long. You can retry in 5 minutes.",
  round_no_pass:
    "We couldn't make creatives that pass our checks this time. Add more detail or update what you told us, then try again.",
  delete_failed: "We couldn't delete that workspace. Try again.",

  round_running: "A round is still running. Wait for it to finish.",
  creative_changed:
    "This creative changed in another window. Reload the page to see it.",
  brief_changed: "The brief changed in another window. Reload to see it.",
  reject_reason_required:
    "Pick a tag or add a note so the next round can improve.",
  edit_headline_empty: "Add a headline to save.",
  edit_headline_words: "The headline is over 6 words. Shorten it to save.",
  edit_headline_chars:
    "The headline is over 75 characters. Shorten it to save.",
  edit_combined_words:
    "The headline and eyebrow together are over 8 words. Shorten the headline to save.",
  edit_cta_empty: "Add a CTA to save.",
  edit_cta_words: "The CTA is over 3 words. Shorten it to save.",
  edit_rejected: "This edit can't be used:",
  edit_claim: "isn't in the confirmed facts.",
  edit_lost_element: "would be dropped from the creative.",
  export_failed: "We couldn't make that download. Try again.",
  library_empty:
    "No finished rounds yet. Make a round and it will show up here.",
  library_no_match: "No creatives match this filter.",

  not_purchasable: "Shoppers can't buy this online right now. Continue anyway?",
  personalize:
    "Shoppers personalize this product before ordering, so every button will invite them to personalize it.",
  transparent:
    "This product looks see-through (glass, acrylic or clear plastic). Cut-outs of clear materials can keep the photo's own backdrop, so check each creative closely.",
  setting_smaller: "Product smaller",
  setting_cutout: "Cut-out preferred",
  setting_plain: "Plain backgrounds",
  setting_scene: "Scene backgrounds",
  setting_cta_brand: "Brand-colored button",
  setting_cta_dark: "Dark button",
  setting_cta_light: "Light button",
  not_applied_prefix: "Noted, not adjustable yet:",
  low_resolution: "This photo is low resolution and may look soft.",
  photo_text: "This photo has text on it; photos without text are used first.",
  photos_skipped:
    "{skipped} of {total} photos couldn't be read and were skipped.",
  photo_skipped: "1 of {total} photos couldn't be read and was skipped.",
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
  "page_unreadable",
  "brand_failed",
  "intake_timed_out",
  "photos_unreadable",
  "photo_check_down",
] as const satisfies readonly MessageCode[];

export type Step1FailureCode = (typeof step1FailureCodes)[number];

// Failures a second attempt at the same link can get past.
export const retryableFailureCodes = [
  "store_unreachable",
  "page_unreadable",
  "brand_failed",
  "intake_timed_out",
  "photos_unreadable",
  "photo_check_down",
  "intake_failed",
] as const satisfies readonly Step1FailureCode[];
