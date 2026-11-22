import type { ConfirmState } from "./types";

// The chosen variant needs an explicit confirmation unless the page showed it can be bought.
export function variantNeedsConfirmation(state: ConfirmState) {
  const chosen = state.variants.find((v) => v.id === state.variantId);
  return state.needsVariantChoice && chosen?.availability !== "buyable";
}

export function purchaseAnswered(state: ConfirmState) {
  return (
    !state.notPurchasable ||
    state.continuePastFlag === true ||
    state.markedAvailable
  );
}

export function canGenerate(state: ConfirmState) {
  const variantReady =
    !state.needsVariantChoice ||
    (state.variantId !== null &&
      (!variantNeedsConfirmation(state) || state.variantConfirmed));
  // A shown price needs an amount; creatives never get an empty one.
  const priceReady = !state.showPrice || state.price !== null;
  return (
    priceReady &&
    state.photos.some((photo) => photo.selected) &&
    purchaseAnswered(state) &&
    variantReady
  );
}
