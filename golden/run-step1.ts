import { existsSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { join } from "node:path";
import { createIntakeDeps, runIntake, type IntakeOutcome } from "@/lib/intake";
import { messages } from "@/lib/messages";
import { caseSchema, readSnapshotJson } from "@/lib/providers/snapshot";
import { loadExpectations, type Expectation } from "./expectations";

process.env.PROVIDERS = "fake";

const normalise = (text: string) => text.replace(/[‘’]/g, "'");

function snapshotDirOf(name: string) {
  return [join(".golden", name), join("golden", "fixtures", name)].find((dir) =>
    existsSync(join(dir, "case.json")),
  );
}

function observe(outcome: IntakeOutcome): Record<string, unknown> {
  if (!outcome.ok) {
    return { message: `Failure: ${messages[outcome.code]}` };
  }
  if ("existingWorkspaceId" in outcome) {
    return { message: null, existingWorkspaceId: outcome.existingWorkspaceId };
  }
  const { productKey, finalUrl, market, page, warnings } = outcome.result;
  return {
    message: null,
    productKey,
    finalUrl,
    market,
    price: page.price,
    wasPrice: page.wasPrice,
    currency: page.currency,
    purchase: page.purchase,
    needsVariantChoice: page.needsVariantChoice,
    buyableVariants: page.variants.filter((v) => v.availability === "buyable")
      .length,
    rating: page.rating,
    warnings: warnings.map((code) => `Warning: ${messages[code]}`),
  };
}

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

function mismatches(expected: Expectation, outcome: IntakeOutcome) {
  const actual = observe(outcome);
  const ingested = outcome.ok && "result" in outcome;
  // Acceptance rule: no ingesting row may ask the tester to pick a variant unless it says so.
  const checked: Record<string, unknown> = {
    ...expected,
    ...(ingested && {
      needsVariantChoice: expected.needsVariantChoice ?? false,
    }),
  };
  delete checked.existingWorkspaces;
  delete checked.note;
  return Object.entries(checked)
    .filter(
      ([field, want]) =>
        want !== undefined &&
        !isDeepStrictEqual(comparable(want), comparable(actual[field])),
    )
    .map(
      ([field, want]) =>
        `${field}: expected ${JSON.stringify(want)}, got ${JSON.stringify(actual[field])}`,
    );
}

async function runCase(name: string, dir: string, expected: Expectation) {
  const { url } = readSnapshotJson(dir, "case.json", caseSchema);
  const deps = createIntakeDeps({
    snapshotDir: dir,
    findWorkspace: async (key) => expected.existingWorkspaces?.[key] ?? null,
  });
  try {
    return mismatches(expected, await runIntake({ url }, deps));
  } catch (error) {
    return [`threw: ${error instanceof Error ? error.message : error}`];
  }
}

async function main() {
  let failed = 0;
  for (const [name, expected] of Object.entries(loadExpectations())) {
    const dir = snapshotDirOf(name);
    if (!dir) {
      console.log(`SKIP ${name} (no snapshot)`);
      continue;
    }
    const problems = await runCase(name, dir, expected);
    console.log(
      problems.length === 0
        ? `PASS ${name}`
        : `FAIL ${name}\n  ${problems.join("\n  ")}`,
    );
    if (problems.length > 0) failed++;
  }
  if (failed > 0) {
    console.error(`${failed} case(s) failed`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
