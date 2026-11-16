import "server-only";
import { touchIntake } from "@/lib/db/queries";
import { INTAKE_HEARTBEAT_MS } from "@/lib/config";
import { IntakeAbandonedError } from "./errors";
import type { IntakeRun } from "./types";

// Keeps progress_at fresh while a step is alive, so only a dead worker trips the stuck rule. `abandoned` rejects once the intake is no longer reading, and `isAbandoned` lets writers stop at once.
export function startHeartbeat(run: IntakeRun) {
  let gone = false;
  let abandon: (error: Error) => void = () => {};
  const abandoned = new Promise<never>((_, reject) => {
    abandon = reject;
  });
  abandoned.catch(() => undefined);

  const timer = setInterval(() => {
    touchIntake(run.userId, run.intakeId).then(
      (reading) => {
        if (reading) return;
        gone = true;
        clearInterval(timer);
        abandon(new IntakeAbandonedError(run.intakeId));
      },
      (error: unknown) =>
        console.error(`intake ${run.intakeId}: heartbeat failed`, error),
    );
  }, INTAKE_HEARTBEAT_MS);
  timer.unref();
  return {
    abandoned,
    isAbandoned: () => gone,
    stop: () => clearInterval(timer),
  };
}
