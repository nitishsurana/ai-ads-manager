import type { ConfirmState } from "./types";

// The chosen variant needs an explicit confirmation unless the page showed it can be bought.
export function variantNeedsConfirmation(state: ConfirmState) {
  const chosen = state.variants.find((v) => v.id === state.variantId);
  return state.needsVariantChoice && chosen?.availability !== "buyable";
}

export function canGenerate(state: ConfirmState) {
  const variantReady =
    !state.needsVariantChoice ||
    (state.variantId !== null &&
      (!variantNeedsConfirmation(state) || state.variantConfirmed));
  return (
    state.photos.some((photo) => photo.selected) &&
    (!state.notPurchasable || state.continuePastFlag === true) &&
    variantReady
  );
}
