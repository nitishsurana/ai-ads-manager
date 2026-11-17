import { SnapshotError } from "@/lib/providers/snapshot";
import { BrandStageError, runBrand } from "./brand";
import { pageFailure, readProductPage } from "./page";
import { type CostEntry, PhotosStageError, runPhotos } from "./photos";
import { fetchProduct } from "./product";
import { marketOf, productKeyOf } from "./product-key";
import { checkStore } from "./store";
import type {
  IntakeDeps,
  IntakeOutcome,
  IntakeResult,
  UntilBrandOutcome,
  UntilBrandReady,
} from "./types";
import { checkUrl } from "./url";

type Input = { url: string; intakeId: string };

// Everything through photos. The golden runner uses it alone for rows recorded before the brand stage, which have no homepage to replay.
export async function runIntakeUntilBrand(
  input: Input,
  deps: IntakeDeps,
): Promise<UntilBrandOutcome> {
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
    captureStyles: { variantIds: product.variants.map((v) => String(v.id)) },
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

  await deps.progress({
    stage: "product",
    product: { title: product.title, price: page.price },
  });

  const photos = await runPhotos(
    { intakeId: input.intakeId, images: product.images },
    deps,
  );
  if (!photos.photos.some((photo) => photo.selected)) {
    // no_photos is for photos that were really dropped, gone or unreadable; a transient fetch or provider failure is retryable.
    const transient = ["fetch_failed", "check_failed"];
    if (photos.skipped.some((s) => transient.includes(s.reason))) {
      throw new PhotosStageError(
        "photos could not be read: fetches or checks failed",
        photos.costs,
      );
    }
    return { ok: false, code: "no_photos" };
  }

  return {
    ok: true,
    result: {
      url: checked.url.href,
      finalUrl: store.finalUrl.href,
      productKey: store.productKey,
      market,
      product,
      page,
      photos,
      warnings: page.purchase === "not_purchasable" ? ["not_purchasable"] : [],
    },
    productPage: {
      url: renderUrl.href,
      html: rendered.html,
      styles: rendered.styles,
    },
  };
}

export async function runIntake(
  input: Input,
  deps: IntakeDeps,
): Promise<IntakeOutcome> {
  const outcome = await runIntakeUntilBrand(input, deps);
  if (!outcome.ok || !("result" in outcome)) return outcome;
  return { ok: true, result: await runIntakeBrand(input, outcome, deps) };
}

export async function runIntakeBrand(
  input: Input,
  { result, productPage }: UntilBrandReady,
  deps: IntakeDeps,
): Promise<IntakeResult> {
  const brandCosts: CostEntry[] = [];
  const brand = await runBrand(
    {
      intakeId: input.intakeId,
      productUrl: productPage.url,
      productHtml: productPage.html,
      productTitle: result.product.title,
      styles: productPage.styles,
      market: result.market,
    },
    deps,
    brandCosts,
  ).catch((error: unknown) => {
    if (error instanceof SnapshotError) throw error;
    // The photos' spend is already incurred, so it travels with the brand stage's.
    const reason = error instanceof Error ? error.message : String(error);
    throw new BrandStageError(
      `brand stage failed: ${reason}`,
      [...result.photos.costs, ...brandCosts],
      { cause: error },
    );
  });
  return { ...result, brand };
}
