import { messages, type MessageCode } from "@/lib/messages";

export type RoundFailure = {
  ok: false;
  code: MessageCode | "not_found";
  // Why Layer 1 refused an edit, for the "edit_rejected" message.
  reason?: string;
};

export type RoundResult<T extends object = object> =
  ({ ok: true } & T) | RoundFailure;

export function failureText(failure: RoundFailure) {
  if (failure.code === "not_found") return messages.save_failed;
  return failure.reason
    ? `${messages[failure.code]} ${failure.reason}`
    : messages[failure.code];
}
