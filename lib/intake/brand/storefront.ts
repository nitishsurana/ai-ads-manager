import { z } from "zod";
import { getFollowingRedirects, type Http } from "@/lib/providers/http";
import { logSwallowed } from "./log";

// Shopify doesn't document token-free access to brand data, so this may stop answering; the chain then moves on.
const API_VERSION = "2026-07";
const QUERY = "{shop{brand{logo{image{url}}}}}";
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 1024 * 1024;

const responseSchema = z.object({
  data: z.object({
    shop: z.object({
      brand: z
        .object({
          logo: z.object({ image: z.object({ url: z.string() }) }).nullable(),
        })
        .nullable(),
    }),
  }),
});

export async function storefrontLogo(
  origin: string,
  label: string,
  deps: { http: Http },
): Promise<string | null> {
  const url = `${origin}/api/${API_VERSION}/graphql.json?query=${encodeURIComponent(QUERY)}`;
  const fetched = await getFollowingRedirects(deps.http, url, {
    maxBytes: MAX_BYTES,
    timeoutMs: TIMEOUT_MS,
  });
  if (!fetched.ok) {
    logSwallowed(label, "storefront request", fetched.reason);
    return null;
  }
  const { status, body } = fetched.response;
  if (status !== 200) {
    logSwallowed(label, "storefront request", `HTTP ${status}`);
    return null;
  }
  try {
    const parsed = responseSchema.parse(JSON.parse(body.toString("utf8")));
    return parsed.data.shop.brand?.logo?.image.url ?? null;
  } catch (error) {
    logSwallowed(label, "storefront response", error);
    return null;
  }
}
