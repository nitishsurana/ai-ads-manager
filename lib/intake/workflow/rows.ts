import type { CompletedIntake, NewPhoto } from "@/lib/db/queries";
import type { Photo } from "../photos";
import type { IntakeResult } from "../types";

export function photoRow(photo: Photo): NewPhoto {
  return {
    position: photo.position,
    source_url: photo.sourceUrl,
    orig_width: photo.origWidth,
    orig_height: photo.origHeight,
    work_path: photo.workPath,
    thumb_path: photo.thumbPath,
    sha256: photo.sha256,
    phash: photo.phash,
    checks: photo.checks,
    tier: photo.tier,
    cutout_path: photo.cutoutPath,
    mask_path: photo.maskPath,
    dropped: photo.dropped,
    drop_reason: photo.dropReason,
    selected: photo.selected,
  };
}

// Everything the confirm screen shows about the product that has no column of its own.
function productJson(result: IntakeResult) {
  return {
    shopify: result.product,
    page: result.page,
    market: result.market,
    finalUrl: result.finalUrl,
    storeName: result.brand.storeName,
    needsBrandName: result.brand.needsBrandName,
    warnings: result.warnings,
    photosSkipped: result.photosSkipped,
  };
}

export function workspaceRow(result: IntakeResult): CompletedIntake {
  return {
    product_key: result.productKey,
    source_url: result.finalUrl,
    product: productJson(result),
    brand_kit_scraped: result.brand.brandKitScraped,
    brand_kit: result.brand.brandKit,
    logo: result.brand.logo,
  };
}
