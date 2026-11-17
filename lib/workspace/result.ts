export type Failure = {
  ok: false;
  code:
    | "not_found"
    | "confirm_locked"
    | "cannot_generate"
    | "save_failed"
    | "spend_cap"
    | "daily_limit"
    | "unrated"
    | "retry_wait";
};
export type Result<T extends object = object> = ({ ok: true } & T) | Failure;
