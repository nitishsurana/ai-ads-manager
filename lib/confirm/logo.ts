import type { LogoSource } from "@/lib/intake";
import type { ConfirmState } from "./types";

const typedName = (state: ConfirmState) => state.brandName.value;

// A typed name becomes the text wordmark, so it counts as a logo.
export function confirmedLogoSource(state: ConfirmState): LogoSource | null {
  return state.logo?.source ?? (typedName(state) ? "wordmark" : null);
}

// The name the wordmark and the ads use: what the tester typed, else the store's own name.
export function confirmedBrandName(state: ConfirmState) {
  return typedName(state) || state.storeName;
}

// Only once the tester has answered the open prompt with a blank, and only when no logo of any kind exists. A real logo beside the default "My Store" name gets no warning.
export function showsNoLogoWarning(state: ConfirmState) {
  const { needed, answered } = state.brandName;
  return needed && answered && typedName(state) === "" && state.logo === null;
}
