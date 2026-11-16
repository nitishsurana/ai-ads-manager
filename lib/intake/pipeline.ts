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

  const fetched = await fetchProduct(
    { origin: store.finalUrl.origin, handle: store.handle },
    deps,
  );
  if (!fetched.ok) return fetched;

  const finalMarket = marketOf(store.finalUrl);
  return {
    ok: true,
    result: {
      url: checked.url.href,
      finalUrl: store.finalUrl.href,
      productKey: store.productKey,
      market: finalMarket === "US" ? marketOf(checked.url) : finalMarket,
      product: fetched.product,
    },
  };
}
