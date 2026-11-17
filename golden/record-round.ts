import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { aiSnapshotKey, createRealAi } from "@/lib/providers/ai";
import { aiSnapshotSchema, readSnapshotJson } from "@/lib/providers/snapshot";
import { briefOf, rowInputs } from "./round/inputs";
import { ROW_CASES } from "./round/rows";
import { runStages } from "./round/run";

process.loadEnvFile(".env.local");
// Step 1 replays from the row's snapshot; only the round's own model calls are live.
process.env.PROVIDERS = "fake";

const ids = process.argv.slice(2);
const rows = ROW_CASES.filter(
  (row) => ids.length === 0 || ids.includes(row.row),
);
if (rows.length === 0) {
  console.error("Usage: tsx golden/record-round.ts [<ID>...]");
  process.exit(1);
}

// Live plan and copy for each row, saved as .golden/<ID>/round/ai.json. An existing recording is kept; delete the file to refresh it.
async function main() {
  const real = createRealAi();
  for (const row of rows) {
    const dir = join(".golden", row.row, "round");
    const file = join(dir, "ai.json");
    const log: Record<string, unknown> = existsSync(file)
      ? readSnapshotJson(dir, "ai.json", aiSnapshotSchema)
      : {};
    let spent = 0;
    const inputs = await rowInputs(row);
    const { planned, copied } = await runStages(
      row.row,
      inputs,
      briefOf(inputs, row.brief),
      {
        async generate(request) {
          const key = aiSnapshotKey(request);
          const kept = log[key];
          if (kept !== undefined) {
            return { object: request.schema.parse(kept), costUsd: null };
          }
          const result = await real.generate(request);
          log[key] = result.object;
          spent += result.costUsd ?? 0;
          return result;
        },
      },
    );
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, `${JSON.stringify(log, null, 2)}\n`);
    console.log(
      `${row.row}: ${planned.length} planned, ${copied.length} with copy, $${spent.toFixed(4)}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
