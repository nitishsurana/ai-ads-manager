import "server-only";
import { initialConfirm, type ConfirmState } from "@/lib/confirm";
import type { WorkspacePhoto, WorkspaceRow } from "@/lib/db/queries";
import { photoWarnings } from "@/lib/intake";
import {
  brandKitSchema,
  logoSchema,
  productJsonSchema,
  storedConfirmSchema,
  type StoredConfirm,
} from "./schemas";

export function toStored(state: ConfirmState): StoredConfirm {
  return {
    continuePastFlag: state.continuePastFlag,
    markedAvailable: state.markedAvailable,
    variantId: state.variantId,
    variantConfirmed: state.variantConfirmed,
    pricingEdited: state.pricingEdited,
    showPrice: state.showPrice,
    price: state.price,
    showWasPrice: state.showWasPrice,
    wasPrice: state.wasPrice,
    currency: state.currency,
    showRating: state.showRating,
    brandName: state.brandName,
  };
}

// The stored result of the intake, then the tester's saved answers on top.
export function buildConfirmState(
  workspace: WorkspaceRow,
  photos: WorkspacePhoto[],
) {
  const product = productJsonSchema.parse(workspace.product);
  const base = initialConfirm({
    product: product.shopify,
    page: product.page,
    warnings: product.warnings,
    photosSkipped: product.photosSkipped,
    photos: {
      photos: photos.map((photo) => ({
        position: photo.position,
        thumbPath: photo.thumbPath,
        tier: photo.tier,
        dropped: false,
        warnings: photoWarnings(photo),
      })),
    },
    brand: {
      storeName: product.storeName,
      needsBrandName: product.needsBrandName,
      logo: workspace.logo ? logoSchema.parse(workspace.logo) : null,
      brandKit: brandKitSchema.parse(workspace.brandKit),
    },
  });

  const saved =
    workspace.confirmed === null
      ? null
      : storedConfirmSchema.safeParse(workspace.confirmed);
  if (saved && !saved.success) {
    console.error(
      `workspace ${workspace.id}: stored answers are unreadable`,
      saved.error,
    );
  }
  const selected = new Map(photos.map((p) => [p.position, p.selected]));
  const state: ConfirmState = {
    ...base,
    ...(saved?.success ? saved.data : {}),
    photos: base.photos.map((photo) => ({
      ...photo,
      selected: selected.get(photo.position) ?? true,
    })),
  };
  return {
    state,
    variants: product.shopify.variants,
    title: product.shopify.title,
  };
}
