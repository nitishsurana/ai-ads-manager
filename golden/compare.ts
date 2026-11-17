import { isDeepStrictEqual } from "node:util";
import type { Expectation } from "./expectations";
import type { ConfirmRun } from "./confirm-check";
import { observe, type Outcome } from "./observe";

const normalise = (text: string) => text.replace(/[‘’]/g, "'");

const comparable = (value: unknown): unknown => {
  if (typeof value === "string") return normalise(value);
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, comparable(v)]),
    );
  }
  return value;
};

const PHOTO_FIELDS = ["uniquePhotos", "shownPhotos", "droppedPositions"];

export const TRIAGE_FIELDS = new Set([
  "shownPhotos",
  "droppedPositions",
  "dropReasons",
  "logoSource",
  "logoColourClass",
]);

export type Diff = { field: string; text: string };

// Expected reasons name only the positions the CSV pins down.
function onlyExpectedReasons(
  actual: Record<string, unknown>,
  expected: Expectation,
) {
  if (!expected.dropReasons) return actual;
  const reasons = actual.dropReasons as Record<string, unknown>;
  return {
    ...actual,
    dropReasons: Object.fromEntries(
      Object.keys(expected.dropReasons).map((p) => [p, reasons[p]]),
    ),
  };
}

function diffsOf(
  checked: Record<string, unknown>,
  actual: Record<string, unknown>,
  prefix = "",
): Diff[] {
  return Object.entries(checked)
    .filter(
      ([field, want]) =>
        want !== undefined &&
        !isDeepStrictEqual(comparable(want), comparable(actual[field])),
    )
    .map(([field, want]) => ({
      field: `${prefix}${field}`,
      text: `${prefix}${field}: expected ${JSON.stringify(want)}, got ${JSON.stringify(actual[field])}`,
    }));
}

export function mismatches(
  expected: Expectation,
  outcome: Outcome,
  extra: Record<string, unknown>,
  confirmed: ConfirmRun[],
) {
  const actual = {
    ...onlyExpectedReasons(observe(outcome), expected),
    ...extra,
  };
  const ingested = outcome.ok && "result" in outcome;
  // Acceptance rule: no ingesting row may ask the tester to pick a variant unless it says so.
  const checked: Record<string, unknown> = {
    ...expected,
    ...(ingested && {
      needsVariantChoice: expected.needsVariantChoice ?? false,
    }),
  };
  for (const field of [
    "existingWorkspaces",
    "note",
    "triage",
    "triageActual",
    "confirmed",
    "scenarios",
  ]) {
    delete checked[field];
  }
  const diffs = diffsOf(checked, actual);
  for (const run of confirmed) {
    const prefix = run.name ? `confirm[${run.name}].` : "confirm.";
    diffs.push(
      ...run.problems.map((text) => ({
        field: "s1",
        text: `${prefix}${text}`,
      })),
      ...diffsOf(run.expected, run.observed, prefix),
    );
  }
  const unpinned = ingested
    ? PHOTO_FIELDS.filter((field) => checked[field] === undefined)
    : [];
  return { diffs, actual, unpinned };
}
