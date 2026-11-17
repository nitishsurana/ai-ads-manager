import type { ActionResult } from "@/app/(workspace)/w/[id]/actions";
import { messages } from "@/lib/messages";

type Failure = Extract<ActionResult, { ok: false }>;

export function failureMessage(failure: Failure) {
  switch (failure.code) {
    case "confirm_locked":
      return messages.confirm_locked;
    case "cannot_generate":
      return messages.cannot_generate;
    default:
      return messages.save_failed;
  }
}
