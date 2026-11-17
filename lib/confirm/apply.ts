import { formatAmount, typedAmount } from "@/lib/money";
import type { Answers } from "./answers";
import type { ConfirmState } from "./types";

// Typed prices are shown the way creatives draw them: symbol and amount, no currency code. A price that isn't a positive amount is null, and the answer carrying it is ignored.
function money(text: string, currency: string) {
  const amount = typedAmount(text);
  return amount === null ? null : formatAmount(amount, currency);
}

// Pure and total: an answer that doesn't validate (a price that isn't above zero, a currency the screen doesn't offer, a variant that doesn't exist) changes nothing.
export function applyAnswers(
  state: ConfirmState,
  answers: Answers,
): ConfirmState {
  const next = structuredClone(state);

  if (answers.continuePastFlag !== undefined) {
    next.continuePastFlag = answers.continuePastFlag;
  }

  const selected = new Set(answers.select);
  const deselected = new Set(answers.deselect);
  for (const photo of next.photos) {
    if (selected.has(photo.position)) photo.selected = true;
    if (deselected.has(photo.position)) photo.selected = false;
  }

  // A strike-through in the old currency would be wrong, so a switch clears it unless the answers add one.
  const switched = answers.currency;
  const switchedPrice = switched && money(switched.price, switched.code);
  if (switched && switchedPrice && next.currencies.includes(switched.code)) {
    if (switched.code !== next.currency) {
      next.showWasPrice = false;
      next.wasPrice = null;
    }
    next.pricingEdited = true;
    next.currency = switched.code;
    next.showPrice = true;
    next.price = switchedPrice;
  }

  const rejected = (typed: string | false | undefined, shown: string | null) =>
    typed && shown === null;
  if (answers.price) {
    const typed = answers.price.show && answers.price.value;
    const edited = typed ? money(typed, next.currency) : null;
    if (!rejected(typed, edited)) {
      if (edited || !answers.price.show) next.pricingEdited = true;
      if (edited) next.price = edited;
      // With no price to show, the field starts hidden.
      next.showPrice = answers.price.show && next.price !== null;
    }
  }
  if (answers.wasPrice) {
    const typed = answers.wasPrice.show && answers.wasPrice.value;
    const added = typed ? money(typed, next.currency) : null;
    if (!rejected(typed, added)) {
      if (added || !answers.wasPrice.show) next.pricingEdited = true;
      if (added) next.wasPrice = added;
      next.showWasPrice = answers.wasPrice.show && next.wasPrice !== null;
    }
  }

  // Only a page that asked for a variant has a picker. The tester's own pricing, typed above or earlier, is never overwritten by a variant's.
  const variant = state.needsVariantChoice
    ? next.variants.find((v) => v.id === answers.variantId)
    : undefined;
  if (variant) {
    next.variantId = variant.id;
    next.variantConfirmed = false;
    if (!next.pricingEdited) {
      next.price = variant.price ?? next.price;
      next.wasPrice = variant.wasPrice;
      next.showWasPrice = variant.wasPrice !== null;
    }
  }
  if (answers.variantConfirmed !== undefined && next.variantId !== null) {
    next.variantConfirmed = answers.variantConfirmed;
  }

  if (answers.showRating !== undefined) {
    next.showRating = next.rating !== null && answers.showRating;
  }

  if (answers.brandName !== undefined && next.brandName.needed) {
    next.brandName = {
      needed: true,
      answered: true,
      value: answers.brandName.trim(),
    };
  }

  const edit = answers.brandKit;
  if (edit) {
    const { palette, ...fields } = edit;
    Object.assign(next.brandKit, fields);
    Object.assign(next.brandKit.palette, palette);
  }

  return next;
}
