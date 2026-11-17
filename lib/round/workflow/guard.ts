import "server-only";
import { SnapshotError } from "@/lib/providers/snapshot";
import type { CostEntry } from "@/lib/intake";
import type { StageDeps } from "../stages";
import type { RoundContext } from "../types";
import { removeRoundFiles } from "./cleanup";
import { createStepDeps } from "./deps";
import { isAbandoned } from "./errors";
import type { createProgressWriter } from "./progress";
import type { StageResult } from "./types";

type Progress = ReturnType<typeof createProgressWriter>;

// Runs a paid stage once and owns its spend. An unexpected error is logged with the round id and handed back as a value, because an error crossing a step boundary loses its carried data. Replay errors are programming errors and still throw.
export async function guardStage<T>(
  ctx: RoundContext,
  progress: Progress,
  stage: (deps: StageDeps) => Promise<T>,
): Promise<StageResult<T>> {
  const costs: CostEntry[] = [];
  const deps = createStepDeps(ctx, {
    progress: progress.onProgress,
    isAbandoned: progress.isAbandoned,
    costs,
  });
  try {
    await progress.flush();
    const value = await stage(deps);
    await progress.flush();
    return { kind: "ok", value, costs };
  } catch (error) {
    if (error instanceof SnapshotError) throw error;
    if (isAbandoned(error)) {
      console.error(`round ${ctx.roundId}: stopped, no longer running`);
      await removeRoundFiles(ctx.roundId).catch((cleanupError: unknown) =>
        console.error(
          `round ${ctx.roundId}: file removal failed`,
          cleanupError,
        ),
      );
      return { kind: "abandoned", costs };
    }
    console.error(`round ${ctx.roundId}: stage failed`, error);
    return { kind: "error", costs };
  }
}
