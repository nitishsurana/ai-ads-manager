import type { DropReason, PhotoChecks } from "./types";

export type DropDecision =
  | { action: "drop"; reason: DropReason }
  | { action: "check_mask" }
  | { action: "keep" };

// Added text on a plain background with no person needs a clean cut-out; a text card with no product goes whatever its background.
export function decideDrop(checks: PhotoChecks): DropDecision {
  if (checks.added_text && !checks.has_product && !checks.person) {
    return { action: "drop", reason: "text_card" };
  }
  const needsCutout =
    checks.added_text && checks.background === "plain" && !checks.person;
  if (!needsCutout) return { action: "keep" };

  if (checks.product_count > 1) {
    return { action: "drop", reason: "multiple_products" };
  }
  if (checks.text_overlaps_product) {
    return { action: "drop", reason: "text_over_product" };
  }
  if (checks.product_cropped_by_frame) {
    return { action: "drop", reason: "product_cropped" };
  }
  return { action: "check_mask" };
}
