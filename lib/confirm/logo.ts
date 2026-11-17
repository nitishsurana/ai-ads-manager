import type { Logo, LogoSource } from "@/lib/intake";
import { wordmark } from "@/lib/intake/brand/wordmark";
import type { ConfirmState } from "./types";

const typedName = (state: ConfirmState) => state.brandName.value;

// The logo the ads use: the one found, else the typed name as a text wordmark.
export function confirmedLogo(state: ConfirmState): Logo | null {
  const name = typedName(state);
  return state.logo ?? (name ? wordmark(name, null) : null);
}

export function confirmedLogoSource(state: ConfirmState): LogoSource | null {
  return confirmedLogo(state)?.source ?? null;
}

// The name the wordmark and the ads use: what the tester typed, else the store's own name.
export function confirmedBrandName(state: ConfirmState) {
  return typedName(state) || state.storeName;
}

// Only once the tester has answered the open prompt with a blank, and only when no logo of any kind exists. A real logo beside the default "My Store" name gets no warning.
export function showsNoLogoWarning(state: ConfirmState) {
  const { needed, answered } = state.brandName;
  return needed && answered && confirmedLogo(state) === null;
}
