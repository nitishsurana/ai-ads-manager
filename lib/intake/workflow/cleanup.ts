import "server-only";
import {
  failIntake,
  getIntake,
  insertMessage,
  markIntakeCleaned,
} from "@/lib/db/queries";
import { messages, type Step1FailureCode } from "@/lib/messages";
import { createStorage } from "./deps";
import type { IntakeRun } from "./types";

const BUCKETS = ["photos", "cutouts", "logos"] as const;

type Ids = Pick<IntakeRun, "userId" | "threadId" | "intakeId">;

// Storage is cleared by listing the intake's prefix, since a thrown stage carries no paths.
export async function removeIntakeFiles(intakeId: string) {
  const storage = createStorage();
  await Promise.all(
    BUCKETS.map((bucket) => storage.removePrefix(bucket, intakeId)),
  );
}

export async function postFailureMessage(run: Ids, code: Step1FailureCode) {
  await insertMessage(run.userId, {
    threadId: run.threadId,
    uiId: `intake-${run.intakeId}-failed`,
    role: "assistant",
    kind: "status",
    parts: [{ type: "text", text: messages[code] }],
  });
}

export function isCleaned(progress: unknown) {
  return (
    typeof progress === "object" &&
    progress !== null &&
    "cleaned" in progress &&
    progress.cleaned === true
  );
}

// The conditional status update is the claim: whoever flips reading to failed owns the cleanup, and a done intake is never touched. An intake already failed but not yet cleaned (a crash, or the stuck rule) is cleaned too. The steps are idempotent. Returns false when it did nothing.
export async function failAndCleanUp(run: Ids, code: Step1FailureCode) {
  let messageCode = code;
  if (!(await failIntake(run.userId, run.intakeId, code))) {
    const intake = await getIntake(run.userId, run.intakeId);
    if (intake?.status !== "failed" || isCleaned(intake.progress)) return false;
    // The message must match the stored code, whoever claimed it.
    messageCode = intake.failureCode ?? code;
  }

  await removeIntakeFiles(run.intakeId);
  await postFailureMessage(run, messageCode);
  await markIntakeCleaned(run.userId, run.intakeId);
  return true;
}
