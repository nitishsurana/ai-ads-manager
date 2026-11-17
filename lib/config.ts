// Firecrawl Standard plan: $99 for 100,000 credits, and its pay-as-you-go packs, are $0.001 a credit (https://www.firecrawl.dev/pricing, checked Nov 16, 2026). One rendered page is one credit.
export const FIRECRAWL_USD_PER_CREDIT = 0.001;

// A reading intake with no progress written for this long is failed.
export const INTAKE_STALE_MS = 90_000;

// Starting value: the workflow gives up between steps once the intake is this old.
export const INTAKE_DEADLINE_MS = 10 * 60_000;

// Progress writes are throttled; a heartbeat covers stages that report nothing (brand), so a live step never looks stuck.
export const PROGRESS_WRITE_INTERVAL_MS = 1_500;
export const INTAKE_HEARTBEAT_MS = 30_000;

// UTC days; an attempt counts once it is running.
export const ROUND_DAILY_LIMIT = 20;

// A running round with no deadline this long (the brief rewrite never finished) is failed.
export const ROUND_REWRITE_S = 60;
