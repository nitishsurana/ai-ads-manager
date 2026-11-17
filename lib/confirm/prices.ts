import { parseAmount } from "@/lib/money";
import type { ConfirmState } from "./types";

// What the creatives get: null when the tester hid the price or left it empty. A strike-through only shows above the price, so one at or below it (or beside no price) is dropped.
export function confirmedPrices(state: ConfirmState) {
  const price = state.showPrice ? state.price : null;
  const wasPrice =
    price !== null &&
    state.showWasPrice &&
    state.wasPrice !== null &&
    parseAmount(state.wasPrice) > parseAmount(price)
      ? state.wasPrice
      : null;
  return { price, wasPrice, currency: state.currency };
}
