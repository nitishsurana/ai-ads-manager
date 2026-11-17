import { existsSync } from "node:fs";
import { join } from "node:path";
import { createAi } from "@/lib/providers/ai";
import { createFal } from "@/lib/providers/fal";
import { readSnapshotJson } from "@/lib/providers/snapshot";
import type { Tile } from "./contact-sheet";
import { liveSchema, runRow } from "./row";
import { ROW_CASES } from "./rows";

type Report = (name: string, problems: string[]) => void;

// Recorded rows: the whole round replays from the row's own recordings (plan, copy, read-backs and judges from ai.json, backgrounds from fal.json, fonts from the committed files) and is held to the pass bar. The time bar reads the time the live run recorded.
export async function rowRounds(report: Report) {
  const sheet: Tile[][] = [];
  for (const row of ROW_CASES) {
    const rowDir = join(".golden", row.row);
    const dir = join(rowDir, "round");
    const name = `round: ${row.row}`;
    if (
      !["ai.json", "fal.json", "live.json"].every((file) =>
        existsSync(join(dir, file)),
      )
    ) {
      console.log(`SKIP ${name} (no live recording)`);
      continue;
    }
    try {
      const live = readSnapshotJson(dir, "live.json", liveSchema);
      const run = await runRow(
        row,
        {
          ai: createAi({ snapshotDir: dir }),
          fal: createFal({
            http: { get: async () => ({ ok: false, reason: "blocked" }) },
            snapshotDir: [dir, rowDir],
          }),
        },
        live.elapsedMs,
      );
      report(name, run.problems);
      sheet.push(run.tiles);
    } catch (error) {
      report(name, [
        `threw: ${error instanceof Error ? error.message : error}`,
      ]);
    }
  }
  return sheet;
}
