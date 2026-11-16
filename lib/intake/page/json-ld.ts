import type { CheerioAPI } from "cheerio";
import { z } from "zod";
import type { ShopifyProduct } from "../product";
import { normalise } from "./text";

type ProductRef = Pick<ShopifyProduct, "title" | "handle" | "variants">;

const numeric = z.coerce.number().finite();

const aggregateRatingSchema = z.object({
  ratingValue: numeric,
  reviewCount: numeric.optional(),
  ratingCount: numeric.optional(),
  itemReviewed: z.object({ name: z.string().optional() }).optional(),
});

const offerSchema = z.object({ url: z.string().optional() });

const listingSchema = z.object({
  url: z.string().optional(),
  offers: z.union([offerSchema, z.array(offerSchema)]).optional(),
});

const nodeSchema = listingSchema.extend({
  "@type": z.union([z.string(), z.array(z.string())]).optional(),
  "@id": z.string().optional(),
  name: z.string().optional(),
  hasVariant: z.array(listingSchema).optional(),
  aggregateRating: z.unknown().optional(),
});

export type JsonLdRating = { value: number; count: number };

function nodesOf(json: unknown): unknown[] {
  if (Array.isArray(json)) return json.flatMap(nodesOf);
  if (typeof json !== "object" || json === null) return [];
  const graph = "@graph" in json ? nodesOf(json["@graph"]) : [];
  return [json, ...graph];
}

function isProductType(type: string | string[] | undefined) {
  return (
    type === undefined ||
    [type].flat().some((t) => t === "Product" || t === "ProductGroup")
  );
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Shopify titles read "Name - Colour"; structured data usually carries just the name.
function sameName(name: string | undefined, title: string) {
  if (name === undefined) return false;
  const wanted = normalise(name);
  return (
    wanted === normalise(title) ||
    wanted === normalise(title.split(" - ")[0] ?? title)
  );
}

function matches(
  node: z.infer<typeof nodeSchema>,
  rating: z.infer<typeof aggregateRatingSchema>,
  product: ProductRef,
) {
  const handle = new RegExp(
    `(?:/products/|#)${escapeRegExp(product.handle)}(?:[/?#]|$)`,
    "i",
  );
  const listings = [node, ...(node.hasVariant ?? [])];
  const urls = [
    node["@id"],
    ...listings.flatMap((l) => [
      l.url,
      ...[l.offers ?? []].flat().map((o) => o.url),
    ]),
  ];
  const variantParams = product.variants.map((v) => `variant=${v.id}`);
  return (
    urls.some(
      (url) =>
        url !== undefined &&
        (handle.test(url) || variantParams.some((p) => url.includes(p))),
    ) ||
    sameName(node.name, product.title) ||
    sameName(rating.itemReviewed?.name, product.title)
  );
}

// Only structured data that belongs to this page's product counts: other Product blocks (recommendations, the store itself) are skipped.
export function jsonLdRating(
  $: CheerioAPI,
  product: ProductRef,
): JsonLdRating | null {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    let json: unknown;
    try {
      json = JSON.parse($(script).text());
    } catch {
      continue;
    }
    for (const raw of nodesOf(json)) {
      const node = nodeSchema.safeParse(raw);
      if (!node.success || !isProductType(node.data["@type"])) continue;
      const rating = aggregateRatingSchema.safeParse(node.data.aggregateRating);
      if (!rating.success || !matches(node.data, rating.data, product)) {
        continue;
      }
      const count = rating.data.reviewCount ?? rating.data.ratingCount ?? 0;
      return { value: rating.data.ratingValue, count };
    }
  }
  return null;
}
