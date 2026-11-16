import "server-only";
import { writeIntakeProgress } from "@/lib/db/queries";
import { PROGRESS_WRITE_INTERVAL_MS } from "@/lib/config";
import type { IntakeProgress } from "../types";
import { IntakeAbandonedError, isAbandoned } from "./errors";
import type { IntakeRun, ProgressState } from "./types";

// Throttled, serialised writes of intakes.progress. Progress is best effort: a failed write is logged and swallowed, except that a write finding the intake no longer reading throws IntakeAbandonedError, which stops the stage.
export function createProgressWriter(
  run: IntakeRun,
  initial: ProgressState["photos"] = [],
) {
  let state: ProgressState = { stage: "photos", photos: initial };
  let lastWrite = 0;
  let queue: Promise<unknown> = Promise.resolve();

  async function write() {
    lastWrite = Date.now();
    const result = queue.then(async () => {
      const reading = await writeIntakeProgress(
        run.userId,
        run.intakeId,
        state,
      );
      if (!reading) throw new IntakeAbandonedError(run.intakeId);
    });
    queue = result.catch(() => undefined);
    try {
      await result;
    } catch (error) {
      if (isAbandoned(error)) throw error;
      console.error(`intake ${run.intakeId}: progress write failed`, error);
    }
  }

  return {
    async onProgress(event: IntakeProgress) {
      const photos = event.photo
        ? [...state.photos, event.photo]
        : state.photos;
      state = {
        stage: event.stage,
        phase: event.phase,
        done: event.done,
        total: event.total,
        photos,
      };
      if (Date.now() - lastWrite >= PROGRESS_WRITE_INTERVAL_MS) await write();
    },
    async setStage(stage: ProgressState["stage"]) {
      state = { photos: state.photos, stage };
      await write();
    },
    flush: write,
  };
}
