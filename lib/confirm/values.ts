import { confirmedBrandName } from "./logo";
import { confirmedPrices } from "./prices";
import type { ConfirmState } from "./types";

// What the creatives and the brief may state about the product: only values the tester left on.
export function confirmedValues(state: ConfirmState) {
  return {
    ...confirmedPrices(state),
    rating:
      state.showRating && state.rating
        ? { value: state.rating.value, count: state.rating.count }
        : null,
    brandName: confirmedBrandName(state),
  };
}

export type ConfirmedValues = ReturnType<typeof confirmedValues>;
