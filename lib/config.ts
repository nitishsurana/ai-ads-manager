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

// Starting values for the creatives, tuned after the first runs.
export const LOGO_MAX_WIDTH_SHARE = 0.24;
// Logo geometry 1, which creatives stored before the 24% cap keep when they are edited.
export const LEGACY_LOGO_MAX_WIDTH_SHARE = 0.18;
export const LOGO_MIN_CONTRAST = 3;
export const TEXT_MIN_CONTRAST = 4.5;
export const CTA_MIN_CONTRAST = 4.5;
export const CTA_MIN_DELTA_E = 20;
// A button stands out from what is behind it by one of these.
export const CTA_STAND_OUT_CONTRAST = 2;
export const CTA_STAND_OUT_DELTA_E = 30;

// Fal's price for one Bria FIBO 2 edit (checked on the Nov 15, 2026 background test); BiRefNet is recorded as billed.
export const BRIA_EDIT_USD = 0.04;

// Starting values for the judge panel, tuned against tester ratings: a creative passes when the mean of its per-criterion medians reaches the mean floor and no criterion median is the failing score. Judges 2 points apart on a criterion make it low confidence.
export const JUDGE_PASS_MEAN = 3;
export const JUDGE_FAIL_MEDIAN = 1;
export const JUDGE_DISAGREEMENT = 2;
export const JUDGE_MAX_SHOWN = 3;

// Layer 1: the product's pixels in the final creative may differ from the re-derived cut-out by this much (mean absolute channel difference, and the share of pixels differing by more than PRODUCT_PIXEL_DELTA), because backgrounds are stored as JPEG.
export const PRODUCT_MEAN_TOLERANCE = 4;
export const PRODUCT_PIXEL_DELTA = 24;
export const PRODUCT_BAD_SHARE = 0.02;
export const PNG_MAX_BYTES = 10 * 1024 * 1024;

// A failing candidate is redone this many times, and only while this share of the round's deadline is still left, which is what a Bria call, the checks and the judge panel need (about 60 of 180 s).
export const MAX_REGENERATIONS = 2;
export const REGENERATION_RESERVE_SHARE = 1 / 3;
