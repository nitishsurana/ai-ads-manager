import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BRIA_EDIT_USD } from "@/lib/config";
import { createRealAi } from "@/lib/providers/ai";
import { writeContactSheet, type Tile } from "./round/contact-sheet";
import { recordingAi } from "./round/record-ai";
import { recordingFal } from "./round/record-fal";
import { runRow, type Live } from "./round/row";
import { ROW_CASES } from "./round/rows";

process.loadEnvFile(".env.local");
// Step 1 replays from the row's snapshot; only the round's own model and Fal calls are live.
process.env.PROVIDERS = "fake";

const MIN_BALANCE_USD = 0.5;
// Bria is $0.04 a call: six candidates and their regenerations.
const MAX_EDITS_PER_ROW = 10;
const DEFAULT_ROWS = ["G06", "G21", "G11", "G28", "G29"];
const BACKUP = process.env.LIVE_BACKUP_DIR;

async function gatewayBalance() {
  const response = await fetch("https://ai-gateway.vercel.sh/v1/credits", {
    headers: { Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}` },
  });
  const body = (await response.json()) as { balance?: string | number };
  return Number(body.balance);
}

const ids = process.argv.slice(2);
const rows = ROW_CASES.filter((row) =>
  (ids.length ? ids : DEFAULT_ROWS).includes(row.row),
);
if (rows.length === 0) {
  console.error("Usage: tsx golden/round-live.ts [<ID>...]");
  process.exit(1);
}

// Each row's whole round with live models and Fal, recorded fresh as .golden/<ID>/round/ (ai.json, fal.json, live.json) so replay passes offline. An earlier recording is copied to LIVE_BACKUP_DIR when set, then replaced.
async function main() {
  const real = createRealAi();
  const sheet: Tile[][] = [];
  let failed = 0;
  for (const row of rows) {
    const balance = await gatewayBalance();
    console.log(`gateway balance before ${row.row}: ${balance.toFixed(4)}`);
    if (!(balance >= MIN_BALANCE_USD)) {
      console.error(`stopping: the balance is under $${MIN_BALANCE_USD}`);
      process.exit(1);
    }
    const rowDir = join(".golden", row.row);
    const dir = join(rowDir, "round");
    if (existsSync(dir)) {
      if (BACKUP) {
        mkdirSync(BACKUP, { recursive: true });
        cpSync(dir, join(BACKUP, `${row.row}-round`), { recursive: true });
      }
      rmSync(dir, { recursive: true, force: true });
    }
    mkdirSync(dir, { recursive: true });

    const log: Record<string, unknown> = {};
    const { ai, spend } = recordingAi(real, log);
    const fal = recordingFal(dir, rowDir, MAX_EDITS_PER_ROW);
    try {
      const run = await runRow(row, { ai, fal: fal.fal });
      const live: Live = {
        elapsedMs: run.elapsedMs,
        planMs: run.timings.planMs,
        copyMs: run.timings.copyMs,
        modelsUsd: Number(spend.usd.toFixed(4)),
        falEdits: fal.calls.edits,
        falMasks: fal.calls.masks,
      };
      writeFileSync(
        join(dir, "live.json"),
        `${JSON.stringify(live, null, 2)}\n`,
      );
      const bria = fal.calls.edits * BRIA_EDIT_USD;
      console.log(
        `${row.row}: ${run.shown.length} shown, ${(run.elapsedMs / 1000).toFixed(1)} s (plan ${(run.timings.planMs / 1000).toFixed(1)}, copy ${(run.timings.copyMs / 1000).toFixed(1)}), models $${live.modelsUsd.toFixed(4)}, Fal ${fal.calls.edits} edits $${bria.toFixed(2)} + ${fal.calls.masks} masks`,
      );
      for (const tile of run.tiles)
        console.log(`  ${tile.caption.join(" | ")}`);
      if (run.problems.length > 0) {
        failed++;
        console.log(`FAIL ${row.row}\n  ${run.problems.join("\n  ")}`);
      } else {
        console.log(`PASS ${row.row}`);
      }
      sheet.push(run.tiles);
    } finally {
      writeFileSync(join(dir, "ai.json"), `${JSON.stringify(log, null, 2)}\n`);
      fal.save();
    }
  }
  await writeContactSheet(sheet);
  console.log(`final gateway balance: ${(await gatewayBalance()).toFixed(4)}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
