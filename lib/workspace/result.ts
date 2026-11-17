export type Failure = {
  ok: false;
  code:
    | "not_found"
    | "confirm_locked"
    | "cannot_generate"
    | "save_failed"
    | "spend_cap";
};
export type Result = { ok: true } | Failure;
