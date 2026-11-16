import "server-only";
import { failStaleIntake, getIntake } from "@/lib/db/queries";
import { INTAKE_STALE_MS } from "@/lib/config";
import { failAndCleanUp, isCleaned } from "./cleanup";

// Every read applies the stuck rule: a reading intake with no progress for INTAKE_STALE_MS is failed first. A failed intake whose cleanup hasn't finished (progress.cleaned unset) is cleaned up again, so a crash mid-cleanup heals on the next read.
export async function readIntake(userId: string, intakeId: string) {
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
