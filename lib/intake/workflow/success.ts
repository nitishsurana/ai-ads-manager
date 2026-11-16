import "server-only";
import {
  completeIntake,
  completeIntakeWithWorkspace,
  getIntake,
  type NewPhoto,
} from "@/lib/db/queries";
import type { Photo } from "../photos";
import type { IntakeResult } from "../types";
import { removeIntakeFiles } from "./cleanup";
import type { IntakeRun } from "./types";

function photoRow(photo: Photo): NewPhoto {
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

function summary(result: IntakeResult) {
  const { product, page, photos, brand } = result;
  const shown = photos.photos.filter((photo) => photo.selected).length;
  const details = [
    `${shown} usable ${shown === 1 ? "photo" : "photos"}`,
    page.price ? `price ${page.price}` : null,
    brand.logo ? "logo found" : "no logo found",
  ];
  return `I read ${product.title}: ${details.filter(Boolean).join(", ")}.`;
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
  };
}

export type Persisted = { workspaceId: string | null };

// One database transaction decides the outcome, so a repeat or a lost race leaves nothing half-built. Files are removed when the intake had already failed, or only points at someone else's workspace; removal is idempotent.
export async function persistSuccess(
  run: IntakeRun,
  result: IntakeResult,
): Promise<Persisted> {
  const { workspaceId, adopted } = await completeIntakeWithWorkspace(
    run.userId,
    run.intakeId,
    {
      workspace: {
        product_key: result.productKey,
        source_url: result.finalUrl,
        product: productJson(result),
        brand_kit_scraped: result.brand.brandKitScraped,
        brand_kit: result.brand.brandKit,
        logo: result.brand.logo,
      },
      photos: result.photos.photos.map(photoRow),
      summary: {
        ui_id: `intake-${run.intakeId}-summary`,
        parts: [{ type: "text", text: summary(result) }],
      },
    },
  );
  if (!adopted) await removeIntakeFiles(run.intakeId);
  return { workspaceId };
}

export async function persistExisting(
  run: IntakeRun,
  existingWorkspaceId: string,
): Promise<Persisted> {
  const completed = await completeIntake(run.userId, run.intakeId, {
    workspaceId: existingWorkspaceId,
    productKey: null,
  });
  if (completed) return { workspaceId: existingWorkspaceId };
  // A retry after the update committed finds the intake already done.
  const intake = await getIntake(run.userId, run.intakeId);
  return {
    workspaceId: intake?.status === "done" ? intake.workspaceId : null,
  };
}
