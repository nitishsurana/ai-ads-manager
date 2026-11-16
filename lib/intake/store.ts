import { z } from "zod";
import { getFollowingRedirects, type HttpResponse } from "@/lib/providers/http";
import { handleOf, productKeyOf } from "./product-key";
import type { IntakeDeps, IntakeFailure } from "./types";
import { isMarketplace } from "./url";

// Only the status line and headers matter for the page itself, so don't pull a whole theme.
const PAGE_MAX_BYTES = 256 * 1024;

const cartSchema = z.object({
  token: z.string(),
  item_count: z.number(),
  currency: z.string(),
});

type StoreCheck =
  | { ok: true; finalUrl: URL; productKey: string; handle: string }
  | IntakeFailure;

// Shopify stamps these on every storefront response, including password, closed and 404 pages.
function hasShopifyHeaders(headers: HttpResponse["headers"]) {
  return (
    headers["powered-by"]?.toLowerCase() === "shopify" ||
    Object.keys(headers).some(
      (name) =>
        name === "x-shopid" ||
        name.startsWith("x-shopify") ||
        name.startsWith("shopify-"),
    )
  );
}

// /cart.js answers in Shopify's cart shape on every live storefront, whatever sits in front of it.
async function cartAnswers(origin: string, deps: Pick<IntakeDeps, "http">) {
  const fetched = await getFollowingRedirects(deps.http, `${origin}/cart.js`, {
    maxBytes: PAGE_MAX_BYTES,
  });
  if (!fetched.ok || fetched.response.status !== 200) return false;
  try {
    const body: unknown = JSON.parse(fetched.response.body.toString("utf8"));
    return cartSchema.safeParse(body).success;
  } catch {
    return false;
  }
}

const PASSWORD_PATH = /^(\/[a-z]{2,3}(-[a-z0-9]{2,4}){0,2})?\/password\/?$/i;

// Bot protection answers 401, 403 or 429 to direct page requests while a live /cart.js still proves the store is Shopify.
function isBotRefusal(status: number) {
  return status === 401 || status === 403 || status === 429;
}

function refusesRequest(status: number) {
  return status === 401 || status === 403 || status === 429 || status >= 500;
}

export async function checkStore(
  url: URL,
  deps: Pick<IntakeDeps, "http">,
): Promise<StoreCheck> {
  const askedForProduct = productKeyOf(url) !== null;

  const page = await getFollowingRedirects(deps.http, url.href, {
    maxBytes: PAGE_MAX_BYTES,
  });
  if (!page.ok) return { ok: false, code: "store_unreachable" };

  const finalUrl = new URL(page.finalUrl);
  const { status, headers } = page.response;
  if (isMarketplace(finalUrl.hostname))
    return { ok: false, code: "not_shopify" };

  let cart: boolean | undefined;
  const liveCart = async () =>
    (cart ??= await cartAnswers(finalUrl.origin, deps));

  const isShopify = hasShopifyHeaders(headers) || (await liveCart());
  if (!isShopify) {
    return {
      ok: false,
      code: refusesRequest(status) ? "store_unreachable" : "not_shopify",
    };
  }

  if (PASSWORD_PATH.test(finalUrl.pathname)) {
    return { ok: false, code: "store_password" };
  }

  const notFound = askedForProduct ? "product_not_found" : "not_a_product";
  if (status === 404) {
    // A closed store also returns 404 on every URL, but its cart endpoint is gone too.
    return {
      ok: false,
      code: (await liveCart()) ? notFound : "store_unreachable",
    };
  }
  // On this path the key comes from the URL as given, so a renamed handle is not followed: an accepted limitation.
  const unreadable = isBotRefusal(status) && (await liveCart());
  if (!unreadable && (status < 200 || status >= 300)) {
    return { ok: false, code: "store_unreachable" };
  }

  const productKey = productKeyOf(finalUrl);
  const handle = handleOf(finalUrl);
  if (!productKey || !handle) return { ok: false, code: notFound };
  return { ok: true, finalUrl, productKey, handle };
}
