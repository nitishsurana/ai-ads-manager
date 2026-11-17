import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isDeepStrictEqual } from "node:util";
import { join } from "node:path";
import {
  type IntakeResult,
  createIntakeDeps,
  runIntake,
  runIntakeUntilBrand,
} from "@/lib/intake";
import { firecrawlSnapshotSchema } from "@/lib/providers/snapshot";
import { caseSchema, readSnapshotJson } from "@/lib/providers/snapshot";
import { createLocalStorage } from "@/lib/providers/storage";
import { type Diff, mismatches, TRIAGE_FIELDS } from "./compare";
import { runConfirm } from "./confirm-check";
import { loadExpectations, type Expectation } from "./expectations";
import type { Outcome } from "./observe";
import { stubBrand } from "./stub-brand";
import { probeLogo, storedLogoFiles } from "./probe";

process.env.PROVIDERS = "fake";

// Rows recorded before the brand stage have no homepage page to replay; their expectations carry no brand fields, so they run the stages up to photos only.
function hasBrandPages(dir: string) {
  const file = join(dir, "firecrawl.json");
  if (!existsSync(file)) return false;
  const pages = Object.keys(
    readSnapshotJson(dir, "firecrawl.json", firecrawlSnapshotSchema),
  );
  return pages.some((page) =>
    /^\/([a-z]{2}(-[a-z]{2})?\/)?$/i.test(new URL(page).pathname),
  );
}

function snapshotDirOf(name: string) {
  return [join(".golden", name), join("golden", "fixtures", name)].find((dir) =>
    existsSync(join(dir, "case.json")),
  );
}

type CaseResult = {
  diffs: Diff[];
  actual: Record<string, unknown>;
  unpinned: string[];
};

const noDiffs: CaseResult = { diffs: [], actual: {}, unpinned: [] };

// A row recorded before the brand stage gets a stub brand, so its confirm scenarios still run.
function fullResult(outcome: Outcome): IntakeResult | null {
  if (!outcome.ok || !("result" in outcome)) return null;
  return "brand" in outcome.result
    ? outcome.result
    : { ...outcome.result, brand: stubBrand };
}

async function runCase(
  name: string,
  dir: string,
  expected: Expectation,
): Promise<CaseResult> {
  const { url } = readSnapshotJson(dir, "case.json", caseSchema);
  const storageDir = mkdtempSync(join(tmpdir(), "golden-"));
  const deps = createIntakeDeps({
    snapshotDir: dir,
    storage: createLocalStorage(storageDir),
    findWorkspace: async (key) => expected.existingWorkspaces?.[key] ?? null,
  });
  try {
    const run = hasBrandPages(dir) ? runIntake : runIntakeUntilBrand;
    const outcome: Outcome = await run({ url, intakeId: name }, deps);
    if (expected.throws) {
      return {
        diffs: [
          {
            field: "throws",
            text: `expected a throw containing "${expected.throws}"`,
          },
        ],
        actual: {},
        unpinned: [],
      };
    }
    const probe = {
      ...(expected.logoProbe && {
        logoProbe: await probeLogo(
          outcome,
          storageDir,
          "centre" in expected.logoProbe,
        ),
      }),
      ...(expected.storedLogoFiles && {
        storedLogoFiles: storedLogoFiles(name, storageDir),
      }),
    };
    const result = fullResult(outcome);
    const confirmed = result ? runConfirm(expected, result) : [];
    return mismatches(expected, outcome, probe, confirmed);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (expected.throws && text.includes(expected.throws)) return noDiffs;
    return {
      diffs: [{ field: "threw", text: `threw: ${text}` }],
      actual: {},
      unpinned: [],
    };
  } finally {
    rmSync(storageDir, { recursive: true, force: true });
  }
}

async function main() {
  let failed = 0;
  let triaged = 0;
  let passed = 0;
  for (const [name, expected] of Object.entries(loadExpectations())) {
    const dir = snapshotDirOf(name);
    if (!dir) {
      console.log(`SKIP ${name} (no snapshot)`);
      continue;
    }
    const { diffs, actual, unpinned } = await runCase(name, dir, expected);
    const judgement = diffs.filter((d) => TRIAGE_FIELDS.has(d.field));
    const rest = diffs.filter((d) => !TRIAGE_FIELDS.has(d.field));
    const pinned = expected.triageActual ?? {};
    const atTriage =
      judgement.every((d) => d.field in pinned) &&
      Object.entries(pinned).every(([field, value]) =>
        isDeepStrictEqual(value, actual[field]),
      );

    if (diffs.length === 0) {
      passed++;
      console.log(
        expected.triage
          ? `PASS ${name} (now matches the CSV: the triage marker can be removed)`
          : `PASS ${name}`,
      );
    } else if (
      expected.triage &&
      rest.length === 0 &&
      Object.keys(pinned).length > 0 &&
      atTriage
    ) {
      triaged++;
      const text = judgement.map((d) => d.text).join("; ");
      console.log(`TRIAGE ${name}: ${text} — ${expected.triage}`);
    } else {
      failed++;
      const drift =
        expected.triage && rest.length === 0 && !atTriage
          ? ["output drifted from triageActual"]
          : [];
      console.log(
        `FAIL ${name}\n  ${[...drift, ...diffs.map((d) => d.text)].join("\n  ")}`,
      );
    }
    if (unpinned.length > 0 && dir.startsWith(".golden")) {
      console.log(`  SKIP photo fields not pinned: ${unpinned.join(", ")}`);
    }
  }
  console.log(`${passed} passed, ${triaged} triage, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
