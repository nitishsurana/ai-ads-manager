import "server-only";
import {
  finishRound,
  writeJudgeRecords,
  type NewCreative,
} from "@/lib/db/queries";
import type { RoundFile } from "../files";
import { removeFiles, removeRoundFiles } from "./cleanup";
import type { RoundRun } from "./types";

export type Finish =
  | { status: "done"; creatives: NewCreative[]; discard: RoundFile[] }
  | { status: "no_pass" }
  | { status: "failed"; error: string }
  | { status: "timed_out" };

// One database transaction decides the outcome. Whatever the round ends as, only the files of shown creatives stay; a repeat finds the round already ended and removes the same files again.
export async function finishAndClean(run: RoundRun, finish: Finish) {
  const status = await finishRound(run.userId, run.roundId, {
    status: finish.status,
    error: finish.status === "failed" ? finish.error : undefined,
    creatives: finish.status === "done" ? finish.creatives : [],
    now: new Date(),
  });
  if (status === "done" && finish.status === "done") {
    await removeFiles(finish.discard);
    // Last, so a failure here can't leave discarded files behind; the step's retry repeats the whole call.
    await writeJudgeRecords(run.userId, run.roundId, finish.creatives);
  } else if (status !== "done") {
    await removeRoundFiles(run.roundId);
  }
  return status;
}
