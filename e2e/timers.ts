// The round timers the dev server runs with (playwright.config.ts passes them as ROUND_DEADLINE_S, RETRY_WAIT_S and STALE_QUEUED_S), short enough to test the timeout, the retry wait and a stale queued round in seconds.
export const ROUND_TIMERS = { deadlineS: 15, retryWaitS: 10, staleQueuedS: 10 };
