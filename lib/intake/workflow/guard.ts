import "server-only";
import { SnapshotError } from "@/lib/providers/snapshot";
import type { IntakeDeps } from "../types";
import type { CostEntry } from "../photos";
import { removeIntakeFiles } from "./cleanup";
import { createStepDeps } from "./deps";
import { isAbandoned } from "./errors";
import { startHeartbeat } from "./heartbeat";
import { createProgressWriter } from "./progress";
import type { IntakeRun, StageResult } from "./types";

type Progress = ReturnType<typeof createProgressWriter>;

// Runs a paid stage once and owns its spend. An unexpected error is logged with the intake id and handed back as a value, because an error crossing a step boundary loses its carried data. Replay errors are programming errors and still throw.
export async function guardStage<T>(
  run: IntakeRun,
  progress: Progress,
  stage: (deps: IntakeDeps) => Promise<T>,
): Promise<StageResult<T>> {
  const costs: CostEntry[] = [];
  const renders: string[] = [];
  const heartbeat = startHeartbeat(run);
  const deps = createStepDeps(run, {
    progress: progress.onProgress,
    isAbandoned: heartbeat.isAbandoned,
    costs,
    renders,
  });
  const spend = { costs, firecrawlRenders: renders };
  try {
    const value = await Promise.race([stage(deps), heartbeat.abandoned]);
    await progress.flush();
    return { kind: "ok", value, ...spend };
  } catch (error) {
    if (error instanceof SnapshotError) throw error;
    if (isAbandoned(error)) {
      console.error(`intake ${run.intakeId}: stopped, no longer reading`);
      await removeIntakeFiles(run.intakeId).catch((cleanupError: unknown) =>
        console.error(
          `intake ${run.intakeId}: file removal failed`,
          cleanupError,
        ),
      );
      return { kind: "abandoned", ...spend };
    }
    console.error(`intake ${run.intakeId}: stage failed`, error);
    return { kind: "error", ...spend };
  } finally {
    heartbeat.stop();
  }
}
