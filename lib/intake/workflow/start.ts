import "server-only";
import { start } from "workflow/api";
// Deep imports keep next/headers (pulled in by the @/lib/db barrel) out of the step bundle.
import {
  createIntake,
  failIntake,
  findReadingIntakeId,
  getThread,
} from "@/lib/db/queries";
import { INTAKE_DEADLINE_MS } from "@/lib/config";
import { IntakeConflictError } from "./errors";
import { intakeWorkflow } from "./workflow";

export async function startIntake(input: {
  userId: string;
  threadId: string;
  url: string;
}) {
  const thread = await getThread(input.userId, input.threadId);
  if (!thread) throw new Error(`thread ${input.threadId} not found`);
  if (thread.workspaceId) {
    throw new IntakeConflictError(
      `thread ${input.threadId} already has a workspace`,
    );
  }
  if (await findReadingIntakeId(input.userId, input.threadId)) {
    throw new IntakeConflictError(
      `thread ${input.threadId} already has a reading intake`,
    );
  }
  const intakeId = await createIntake(input);
  if (!intakeId) {
    throw new IntakeConflictError(
      `thread ${input.threadId} already has a reading intake`,
    );
  }
  try {
    await start(intakeWorkflow, [
      { ...input, intakeId, deadlineAt: Date.now() + INTAKE_DEADLINE_MS },
    ]);
  } catch (error) {
    await failIntake(input.userId, intakeId, "intake_failed");
    throw error;
  }
  return intakeId;
}
