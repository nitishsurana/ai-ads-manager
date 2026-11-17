import type { PageStyles } from "@/lib/providers/firecrawl";

export const IMAGES = "https://cdn.shopify.com/s/files/1/0001/files";
export const STOREFRONT_QUERY = encodeURIComponent(
  "{shop{brand{logo{image{url}}}}}",
);

export type Verdict = {
  has_brand_name: boolean;
  text_read: string;
  is_store_brand: boolean;
};
export const accepted = (text: string): Verdict => ({
  has_brand_name: true,
  text_read: text,
  is_store_brand: true,
});
export const iconOnly: Verdict = {
  has_brand_name: false,
  text_read: "",
  is_store_brand: false,
};
export const otherBrand = (text: string): Verdict => ({
  has_brand_name: true,
  text_read: text,
  is_store_brand: false,
});

export const COPY = {
  tone: ["warm", "plain", "honest"],
  audience: "Home cooks who want simple, well-made things.",
  value_propositions: [
    "Made in small batches",
    "Fair prices",
    "Quick shipping",
  ],
  proof_points: ["Family owned since 2009"],
};
export const CLEAN_CHECK = {
  added_text: false,
  background: "plain",
  person: false,
  has_product: true,
  product_count: 1,
  text_overlaps_product: false,
  product_cropped_by_frame: false,
  confidence: "high",
};

export type Spec = {
  name: string;
  host?: string;
  head?: string;
  header: string;
  footer?: string;
  homeHead?: string;
  // The about page's HTML; its link is the homepage's own `aboutLink`. Omitted: no about page.
  about?: string;
  // Files served by the image CDN, by name; a number is an error status.
  files?: Record<string, Buffer | number>;
  // The Storefront API answer: a logo URL, null for no logo, or an error status.
  storefront?: string | null | number;
  verdicts?: Verdict[];
  // The computed-style capture that came with the product page render.
  styles?: PageStyles;
};
