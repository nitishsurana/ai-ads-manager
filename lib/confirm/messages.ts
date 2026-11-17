import { messages, type MessageCode } from "@/lib/messages";
import { showsNoLogoWarning } from "./logo";
import type { ConfirmState } from "./types";

export type ConfirmMessage = {
  code: Extract<
    MessageCode,
    | "not_purchasable"
    | "personalize"
    | "low_resolution"
    | "photo_text"
    | "transparent"
    | "no_logo"
  >;
  text: string;
  // The photo a warning sits on; null for flags that belong to the product.
  position: number | null;
};

const message = (
  code: ConfirmMessage["code"],
  position: number | null = null,
): ConfirmMessage => ({ code, text: messages[code], position });

// The warnings the screen shows. Photo warnings repeat once per affected selected photo.
export function confirmMessages(state: ConfirmState): ConfirmMessage[] {
  const selected = state.photos.filter((photo) => photo.selected);
  return [
    ...(state.notPurchasable ? [message("not_purchasable")] : []),
    ...(state.orderFlow === "personalize" ? [message("personalize")] : []),
    ...selected.flatMap((photo) =>
      photo.warnings.map((code) => message(code, photo.position)),
    ),
    ...(showsNoLogoWarning(state) ? [message("no_logo")] : []),
  ];
}
