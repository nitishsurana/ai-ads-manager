import "server-only";
import { listReadingIntakeIds, housekeepRounds } from "@/lib/db/queries";
import { ROUND_REWRITE_S } from "@/lib/config";
import { getEnv } from "@/lib/env";
import { readIntake } from "@/lib/intake/workflow";
import { removeRoundFiles } from "./workflow/cleanup";

// The compare-and-set rules, run on every round start and poll: a running round past its deadline times out, a stale queued round or a stuck brief rewrite fails, and a reading intake with no progress for 90 seconds fails (readIntake applies that rule and its cleanup). Files of the rounds it ended are removed here, since it owns them.
export async function housekeep(userId: string) {
  const ended = await housekeepRounds(userId, {
    staleQueuedS: getEnv().STALE_QUEUED_S,
    rewriteS: ROUND_REWRITE_S,
    now: new Date(),
  });
  await Promise.all(
    ended.map((roundId) =>
      removeRoundFiles(roundId).catch((error: unknown) =>
        console.error(`round ${roundId}: file removal failed`, error),
      ),
    ),
  );
  for (const intakeId of await listReadingIntakeIds(userId)) {
    await readIntake(userId, intakeId);
  }
}
