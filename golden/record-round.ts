import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aiSnapshotKey, createRealAi } from "@/lib/providers/ai";
import { createFontReplayHttp, FONT_FIXTURES } from "@/lib/providers/http";
import { aiSnapshotSchema, readSnapshotJson } from "@/lib/providers/snapshot";
import { createLocalStorage } from "@/lib/providers/storage";
import { briefOf, rowRound } from "./round/inputs";
import { memoryPhotos } from "./round/photos";
import { recordingFal } from "./round/record-fal";
import { ROW_CASES } from "./round/rows";
import { runRender, runStages } from "./round/run";

process.loadEnvFile(".env.local");
// Step 1 replays from the row's snapshot; only the round's own model calls are live.
process.env.PROVIDERS = "fake";

// Bria is about $0.04 a call: six candidates a row.
const MAX_EDITS_PER_ROW = 6;

const ids = process.argv.slice(2);
const rows = ROW_CASES.filter(
  (row) => ids.length === 0 || ids.includes(row.row),
);
if (rows.length === 0) {
  console.error("Usage: tsx golden/record-round.ts [<ID>...]");
  process.exit(1);
}

// Live plan and copy for each row, saved as .golden/<ID>/round/ai.json, then live Fal for its backgrounds (fal.json beside it). An existing recording is kept; delete the file to refresh it.
async function main() {
  const real = createRealAi();
  for (const row of rows) {
    const rowDir = join(".golden", row.row);
    const dir = join(rowDir, "round");
    const file = join(dir, "ai.json");
    const log: Record<string, unknown> = existsSync(file)
      ? readSnapshotJson(dir, "ai.json", aiSnapshotSchema)
      : {};
    let spent = 0;
    const storageDir = mkdtempSync(join(tmpdir(), "golden-record-"));
    try {
      const storage = createLocalStorage(storageDir);
      const { inputs, photos } = await rowRound(row, storage);
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

      const recorder = recordingFal(dir, rowDir, MAX_EDITS_PER_ROW);
      try {
        await runRender(row.row, inputs, copied, {
          fal: recorder.fal,
          http: createFontReplayHttp(FONT_FIXTURES),
          storage,
          photos: memoryPhotos(photos),
        });
      } finally {
        recorder.save();
      }
      console.log(
        `${row.row}: ${planned.length} planned, ${copied.length} with copy, $${spent.toFixed(4)} models, ${recorder.calls.masks} new masks, ${recorder.calls.edits} new Bria edits`,
      );
    } finally {
      rmSync(storageDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
