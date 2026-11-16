import { pageFailure, readProductPage } from "./page";
import { fetchProduct } from "./product";
import { marketOf, productKeyOf } from "./product-key";
import { checkStore } from "./store";
import type { IntakeDeps, IntakeOutcome } from "./types";
import { checkUrl } from "./url";

export async function runIntake(
  input: { url: string },
  deps: IntakeDeps,
): Promise<IntakeOutcome> {
  const checked = checkUrl(input.url);
  if (!checked.ok) return checked;

  const provisionalKey = productKeyOf(checked.url);
  if (provisionalKey) {
    const existing = await deps.findWorkspace(provisionalKey);
    if (existing) return { ok: true, existingWorkspaceId: existing };
  }

  const store = await checkStore(checked.url, deps);
  if (!store.ok) return store;

  if (store.productKey !== provisionalKey) {
    const existing = await deps.findWorkspace(store.productKey);
    if (existing) return { ok: true, existingWorkspaceId: existing };
  }

  const finalMarket = marketOf(store.finalUrl);
  const market = finalMarket === "US" ? marketOf(checked.url) : finalMarket;

  const fetched = await fetchProduct(
    { origin: store.finalUrl.origin, handle: store.handle, country: market },
    deps,
  );
  if (!fetched.ok) return fetched;
  const { product } = fetched;

  // The page is rendered without the query string, so ?variant= can't change what shows on load.
  const renderUrl = new URL(store.finalUrl.pathname, store.finalUrl.origin);
  const rendered = await deps.firecrawl.scrapePage(renderUrl.href, {
    country: market,
    waitForWidgets: true,
  });
  if (rendered.status >= 400) {
    throw new Error(
      `Product page ${renderUrl.href} returned ${rendered.status}`,
    );
  }

  const page = readProductPage({ html: rendered.html, product, market });
  const failure = pageFailure(page);
  if (failure) return { ok: false, code: failure };
  if (product.images.length === 0) return { ok: false, code: "no_photos" };

  return {
    ok: true,
    result: {
      url: checked.url.href,
      finalUrl: store.finalUrl.href,
      productKey: store.productKey,
      market,
      product,
      page,
      warnings: page.purchase === "not_purchasable" ? ["not_purchasable"] : [],
    },
  };
}
