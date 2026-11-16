import { z } from "zod";
import { getFollowingRedirects } from "@/lib/providers/http";
import type { IntakeDeps, IntakeFailure } from "./types";

const productSchema = z
  .object({
    product: z.object({
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
      compareAtPrice: v.compare_at_price,
      options: [v.option1, v.option2, v.option3].filter((o) => o !== null),
    })),
  }));

export type ShopifyProduct = z.infer<typeof productSchema>;

export async function fetchProduct(
  { origin, handle }: { origin: string; handle: string },
  deps: Pick<IntakeDeps, "http">,
): Promise<{ ok: true; product: ShopifyProduct } | IntakeFailure> {
  const jsonUrl = `${origin}/products/${handle}.json`;

  const fetched = await getFollowingRedirects(deps.http, jsonUrl);
  if (!fetched.ok || fetched.response.status !== 200) {
    return { ok: false, code: "store_unreachable" };
  }
  if (fetched.response.truncated) {
    throw new Error(`Product JSON was truncated: ${jsonUrl}`);
  }
  const body: unknown = JSON.parse(fetched.response.body.toString("utf8"));
  return { ok: true, product: productSchema.parse(body) };
}
