import * as cheerio from "cheerio";
import { z } from "zod";
import { getFollowingRedirects } from "@/lib/providers/http";
import type { IntakeDeps, IntakeFailure } from "./types";

const productSchema = z
  .object({
    product: z.object({
      id: z.number().int(),
      title: z.string(),
      handle: z.string(),
      images: z.array(
        z.object({
          src: z.url(),
          width: z.number().int(),
          height: z.number().int(),
        }),
      ),
      variants: z.array(
        z.object({
          id: z.number().int(),
          title: z.string(),
          price: z.string(),
          compare_at_price: z.string().nullable(),
          option1: z.string().nullable(),
          option2: z.string().nullable(),
          option3: z.string().nullable(),
        }),
      ),
      options: z.array(
        z.object({ name: z.string(), values: z.array(z.string()) }),
      ),
    }),
  })
  .transform(({ product }) => ({
    ...product,
    variants: product.variants.map((v) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      compareAtPrice: v.compare_at_price || null,
      options: [v.option1, v.option2, v.option3].filter((o) => o !== null),
    })),
  }));

export type ShopifyProduct = z.infer<typeof productSchema>;

const REFUSED = new Set([401, 403, 429]);

// Bot protection answers the document with HTML or a JSON viewer page, so look for the JSON inside it.
function jsonIn(body: string, url: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    const $ = cheerio.load(body);
    const text = $("pre").first().text() || $("body").text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `Product JSON from ${url} was not JSON (a challenge page?)`,
      );
    }
  }
}

export async function fetchProduct(
  {
    origin,
    handle,
    country,
  }: { origin: string; handle: string; country: string },
  deps: Pick<IntakeDeps, "http" | "firecrawl">,
): Promise<{ ok: true; product: ShopifyProduct } | IntakeFailure> {
  const jsonUrl = `${origin}/products/${handle}.json`;

  const fetched = await getFollowingRedirects(deps.http, jsonUrl);
  if (!fetched.ok) return { ok: false, code: "store_unreachable" };

  let text: string;
  if (REFUSED.has(fetched.response.status)) {
    const page = await deps.firecrawl.scrapePage(jsonUrl, {
      country,
      waitForWidgets: false,
    });
    if (page.status === 404) return { ok: false, code: "product_not_found" };
    if (page.status !== 200) return { ok: false, code: "store_unreachable" };
    text = page.html;
  } else if (fetched.response.status === 200) {
    if (fetched.response.truncated) {
      throw new Error(`Product JSON was truncated: ${jsonUrl}`);
    }
    text = fetched.response.body.toString("utf8");
  } else if (fetched.response.status === 404) {
    return { ok: false, code: "product_not_found" };
  } else {
    return { ok: false, code: "store_unreachable" };
  }
  return { ok: true, product: productSchema.parse(jsonIn(text, jsonUrl)) };
}
