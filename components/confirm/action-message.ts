import type { ActionResult } from "@/app/(workspace)/w/[id]/actions";
import { messages } from "@/lib/messages";

type Failure = Extract<ActionResult, { ok: false }>;

export function failureMessage(failure: Failure) {
  switch (failure.code) {
    case "confirm_locked":
      return messages.confirm_locked;
    case "cannot_generate":
      return messages.cannot_generate;
    case "spend_cap":
      return messages.spend_cap;
    case "daily_limit":
      return messages.daily_limit;
    case "unrated":
      return messages.unrated_creatives;
    case "retry_wait":
      return messages.round_timed_out;
    default:
      return messages.save_failed;
  }
}
