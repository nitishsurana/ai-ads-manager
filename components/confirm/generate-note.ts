import { variantNeedsConfirmation, type ConfirmState } from "@/lib/confirm";
import { plural } from "@/lib/utils";

type Note = { text: string; tone: "muted" | "warning" | "error" };

// What the bottom bar says, most blocking first. The blocking cases mirror canGenerate, plus a currency switch still waiting for its price.
export function generateNote(
  state: ConfirmState,
  options: { switching: string | null; pendingFacts: number; edit: boolean },
): Note {
  if (!state.photos.some((photo) => photo.selected)) {
    return { tone: "error", text: "Select at least one photo to continue." };
  }
  if (state.notPurchasable && state.continuePastFlag !== true) {
    return {
      tone: "error",
      text: "Answer the purchase flag at the top to continue.",
    };
  }
  if (state.needsVariantChoice && state.variantId === null) {
    return { tone: "error", text: "Choose a variant to continue." };
  }
  if (
    state.needsVariantChoice &&
    variantNeedsConfirmation(state) &&
    !state.variantConfirmed
  ) {
    return {
      tone: "error",
      text: "Confirm the variant at the top to continue.",
    };
  }
  if (state.showPrice && state.price === null) {
    return {
      tone: "error",
      text: "Enter a price, or turn off Show price, to continue.",
    };
  }
  if (options.switching) {
    return {
      tone: "error",
      text: `Enter the price in ${options.switching} to continue.`,
    };
  }
  const { pendingFacts } = options;
  if (pendingFacts > 0) {
    return {
      tone: "warning",
      text: `${pendingFacts} ${plural(pendingFacts, "fact isn’t", "facts aren’t")} confirmed, so ${plural(pendingFacts, "it won’t", "they won’t")} appear in ads.`,
    };
  }
  return {
    tone: "muted",
    text: options.edit
      ? "Changes apply from your next round."
      : "Takes up to 3 minutes. You’ll get up to 3 creatives.",
  };
}
