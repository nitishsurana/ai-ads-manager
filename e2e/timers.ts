// The round timers the dev server runs with (playwright.config.ts passes them as ROUND_DEADLINE_S, RETRY_WAIT_S and STALE_QUEUED_S), short enough to test the timeout, the retry wait and a stale queued round in seconds.
// The deadline is 40 s because a fake round runs Layer 1 (a Satori render and pixel checks per candidate) and a judge panel under `next dev`, which takes about 15 s; a regeneration may start in the first two thirds of it, so 15 s left no room for one.
export const ROUND_TIMERS = { deadlineS: 40, retryWaitS: 10, staleQueuedS: 10 };
