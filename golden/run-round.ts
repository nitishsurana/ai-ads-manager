import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { briefContentSchema } from "@/lib/brief/schema";
import { createAi } from "@/lib/providers/ai";
import { readSnapshotJson } from "@/lib/providers/snapshot";
import { roundInputsSchema } from "@/lib/round/inputs";
import { expectSchema, roundProblems } from "./round/assert";
import { briefOf, rowInputs } from "./round/inputs";
import { ROW_CASES } from "./round/rows";
import { BACKDROP_CASES } from "./round/backdrop-cases";
import { CHECK_CASES } from "./round/check-cases";
import { COPY_CASES } from "./round/copy-cases";
import { CTA_CASES } from "./round/cta-cases";
import { EDIT_CASES } from "./round/edit-cases";
import { JUDGE_TABLES } from "./round/judge-cases";
import { LOGO_CASES } from "./round/logo-cases";
import { PIXEL_CASES } from "./round/pixel-cases";
import { PLAN_CASES } from "./round/plan-cases";
import { writeContactSheet } from "./round/contact-sheet";
import { fixtureRenders, layoutCases } from "./round/render-run";
import { rowRounds } from "./round/rows-run";
import { runStages } from "./round/run";

process.env.PROVIDERS = "fake";

const FIXTURES = join("golden", "fixtures");

const fixtureSchema = z.object({
  inputs: roundInputsSchema,
  brief: briefContentSchema,
});

async function runCase(
  name: string,
  load: () => Promise<{
    inputs: z.infer<typeof roundInputsSchema>;
    brief: z.infer<typeof briefContentSchema>;
    dir: string;
    expect: z.infer<typeof expectSchema>;
  }>,
) {
  const { inputs, brief, dir, expect } = await load();
  const result = await runStages(
    name,
    inputs,
    brief,
    createAi({ snapshotDir: dir }),
  );
  return roundProblems(inputs, brief, expect, result);
}

async function main() {
  let passed = 0;
  let failed = 0;
  const report = (name: string, problems: string[]) => {
    if (problems.length === 0) {
      passed++;
      console.log(`PASS ${name}`);
    } else {
      failed++;
      console.log(`FAIL ${name}\n  ${problems.join("\n  ")}`);
    }
  };

  for (const row of ROW_CASES) {
    const dir = join(".golden", row.row, "round");
    if (!existsSync(join(dir, "ai.json"))) {
      console.log(`SKIP ${row.row} (no round recording)`);
      continue;
    }
    report(
      row.row,
      await runCase(row.row, async () => {
        const inputs = await rowInputs(row);
        return { inputs, brief: briefOf(inputs, row.brief), dir, expect: {} };
      }),
    );
  }

  for (const name of readdirSync(FIXTURES).sort()) {
    const dir = join(FIXTURES, name);
    if (!name.startsWith("round-")) continue;
    report(
      name,
      await runCase(name, async () => ({
        ...readSnapshotJson(dir, "inputs.json", fixtureSchema),
        dir,
        expect: readSnapshotJson(dir, "expect.json", expectSchema),
      })),
    );
  }
  layoutCases(report);
  for (const { name, run } of [
    ...BACKDROP_CASES,
    ...JUDGE_TABLES,
    ...CHECK_CASES,
    ...COPY_CASES,
    ...CTA_CASES,
    ...EDIT_CASES,
    ...LOGO_CASES,
    ...PIXEL_CASES,
    ...PLAN_CASES,
  ]) {
    try {
      const problem = await run();
      report(name, problem ? [problem] : []);
    } catch (error) {
      report(name, [
        `threw: ${error instanceof Error ? error.message : error}`,
      ]);
    }
  }
  await fixtureRenders(report);
  await writeContactSheet(await rowRounds(report));
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
