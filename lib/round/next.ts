import type { Round } from "@/lib/db/queries";

export type Next =
  | { kind: "next"; n: number; attempt: number; ratedCheck: string | null }
  | { kind: "wait" };

// Which round a start would make: the first, the next after a finished one (its creatives must all be rated), or another attempt of one that didn't finish. A timed-out round allows its retry only RETRY_WAIT_S after it ended; a no-pass or failed one at once.
export function nextRound(
  latest: Round | null,
  now: Date,
  retryWaitS: number,
): Next {
  if (!latest) return { kind: "next", n: 1, attempt: 1, ratedCheck: null };
  if (latest.status === "done") {
    return { kind: "next", n: latest.n + 1, attempt: 1, ratedCheck: latest.id };
  }
  if (
    latest.status === "timed_out" &&
    latest.finishedAt &&
    now.getTime() < Date.parse(latest.finishedAt) + retryWaitS * 1000
  ) {
    return { kind: "wait" };
  }
  return {
    kind: "next",
    n: latest.n,
    attempt: latest.attempt + 1,
    ratedCheck: null,
  };
}
