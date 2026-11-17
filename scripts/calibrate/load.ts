import { listAdminData } from "@/lib/db/queries";
import { judgeRecordSchema, type JudgeRecord } from "@/lib/round/judge/schema";
import type { Skipped } from "./analyze";

export type Sample = {
  roundId: string;
  rating: "approve" | "reject" | null;
  record: JudgeRecord;
  // Creatives with a judge record in the same round.
  shown: number;
};

// Every tester's judged creatives on purpose: this runs from the command line only, never from the app.
export async function loadSamples(includeGolden: boolean) {
  const data = await listAdminData();
  const golden = new Set(
    data.testers.filter((t) => t.is_golden).map((t) => t.user_id),
  );
  const owner = new Map(data.workspaces.map((w) => [w.id, w.user_id]));
  const skipped: Skipped = { records: 0, rounds: 0 };

  const kept = new Set<string>();
  for (const round of data.rounds) {
    const user = owner.get(round.workspace_id);
    if (user === undefined) {
      skipped.rounds++;
      console.error(
        `calibrate: round ${round.id} has no workspace ${round.workspace_id}, dropped`,
      );
    } else if (includeGolden || !golden.has(user)) {
      kept.add(round.id);
    }
  }

  const judged = data.creatives.flatMap((row) => {
    if (row.judge === null || !kept.has(row.round_id)) return [];
    const parsed = judgeRecordSchema.safeParse(row.judge);
    if (!parsed.success) {
      skipped.records++;
      console.error(
        `calibrate: creative ${row.id} judge is unreadable`,
        parsed.error,
      );
      return [];
    }
    return [{ row, record: parsed.data }];
  });

  const shown = new Map<string, number>();
  for (const { row } of judged) {
    shown.set(row.round_id, (shown.get(row.round_id) ?? 0) + 1);
  }
  const samples = judged.map(({ row, record }): Sample => ({
    roundId: row.round_id,
    rating:
      row.rating === "approve" || row.rating === "reject" ? row.rating : null,
    record,
    shown: shown.get(row.round_id) ?? 0,
  }));
  return { samples, skipped };
}
