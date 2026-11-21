import "server-only";
import { cache } from "react";
import { z } from "zod";
import {
  failStaleIntake,
  getIntake,
  getLatestIntake,
  getThread,
  type Intake,
} from "@/lib/db/queries";
import { INTAKE_STALE_MS } from "@/lib/config";
import { retryableFailureCodes } from "@/lib/messages";
import { failAndCleanUp, isCleaned } from "./cleanup";

const isRetryable = (code: Intake["failureCode"]) =>
  retryableFailureCodes.some((retryable) => retryable === code);

// Every read applies the stuck rule: a reading intake with no progress for INTAKE_STALE_MS is failed first. A failed intake whose cleanup hasn't finished (progress.cleaned unset) is cleaned up again, so a crash mid-cleanup heals on the next read.
async function settleIntake(userId: string, intakeId: string) {
  if (!z.uuid().safeParse(intakeId).success) return null;
  let intake = await getIntake(userId, intakeId);
  if (!intake) return null;

  if (
    intake.status === "reading" &&
    (await failStaleIntake(userId, intakeId, INTAKE_STALE_MS))
  ) {
    console.error(`intake ${intakeId}: no progress, marked failed`);
    intake = await getIntake(userId, intakeId);
  }

  if (intake?.status === "failed" && !isCleaned(intake.progress)) {
    try {
      await failAndCleanUp(
        { userId, threadId: intake.threadId, intakeId },
        intake.failureCode ?? "intake_failed",
      );
    } catch (error) {
      console.error(`intake ${intakeId}: cleanup failed`, error);
    }
    return getIntake(userId, intakeId);
  }
  return intake;
}

// canRetry: a retryable failure that is the thread's newest intake, in a thread with no workspace. It is only looked up for those failures, since readIntake also runs on every chat pane and housekeeping pass.
export const readIntake = cache(async function readIntake(
  userId: string,
  intakeId: string,
) {
  const intake = await settleIntake(userId, intakeId);
  if (!intake) return null;
  let canRetry = false;
  if (intake.status === "failed" && isRetryable(intake.failureCode)) {
    const [thread, latest] = await Promise.all([
      getThread(userId, intake.threadId),
      getLatestIntake(userId, intake.threadId),
    ]);
    canRetry = !!thread && !thread.workspaceId && latest?.id === intakeId;
  }
  return { ...intake, canRetry };
});
