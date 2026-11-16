import { existsSync } from "node:fs";
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

function observe(outcome: IntakeOutcome) {
  if (!outcome.ok) {
    return { message: `Failure: ${messages[outcome.code]}` };
  }
  if ("existingWorkspaceId" in outcome) {
    return { message: null, existingWorkspaceId: outcome.existingWorkspaceId };
  }
  const { productKey, finalUrl, market } = outcome.result;
  return { message: null, productKey, finalUrl, market };
}

function mismatches(expected: Expectation, outcome: IntakeOutcome) {
  const actual: Record<string, string | null | undefined> = observe(outcome);
  const checked = {
    message: expected.message,
    existingWorkspaceId: expected.existingWorkspaceId,
    productKey: expected.productKey,
    finalUrl: expected.finalUrl,
    market: expected.market,
  };
  return Object.entries(checked)
    .filter(([field, want]) => {
      if (want === undefined) return false;
      const got = actual[field];
      return typeof want === "string" && typeof got === "string"
        ? normalise(want) !== normalise(got)
        : want !== got;
    })
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
