import { creativeRows } from "../creatives";
import { discardedFiles } from "../files";
import type { Candidate } from "../types";
import {
  backgroundsStep,
  checksStep,
  claimRoundStep,
  compositeStep,
  copyStep,
  finishRoundStep,
  planStep,
  recordCostsStep,
  rewriteBriefStep,
  startDeadlineStep,
} from "./steps";
import type { CostEntry } from "@/lib/intake";
import type { Finish } from "./finish";
import type { RoundRun, StageResult } from "./types";

type Ending = Finish | { status: "abandoned" };

const failed = (error: string): Ending => ({ status: "failed", error });

export async function roundWorkflow(run: RoundRun) {
  "use workflow";

  const costs: CostEntry[] = [];
  let deadlineAt = Number.POSITIVE_INFINITY;

  // The next stage's input, or the ending that stops the round. A stage that returns after the deadline ends the round as timed out.
  const settle = <T>(
    result: StageResult<T>,
  ): { value: T } | { ending: Ending } => {
    costs.push(...result.costs);
    if (result.kind === "abandoned") return { ending: { status: "abandoned" } };
    if (result.kind === "error") return { ending: failed("stage_failed") };
    if (Date.now() > deadlineAt) return { ending: { status: "timed_out" } };
    return { value: result.value };
  };

  const play = async (): Promise<Ending> => {
    try {
      const claimed = await claimRoundStep(run);
      if (!claimed) return { status: "abandoned" };
      let ctx = claimed;

      if (ctx.n > 1) {
        const rewrite = await rewriteBriefStep(ctx);
        costs.push(...rewrite.costs);
        if (rewrite.kind === "abandoned") return { status: "abandoned" };
        if (rewrite.kind === "error") return failed("brief_rewrite");
        ctx = { ...ctx, briefVersion: rewrite.value };
      }

      const deadline = await startDeadlineStep(run);
      if (deadline === null) return { status: "abandoned" };
      deadlineAt = deadline;

      const planned = settle(await planStep(ctx));
      if ("ending" in planned) return planned.ending;
      const written = settle(await copyStep(ctx, planned.value));
      if ("ending" in written) return written.ending;
      const backgrounds = settle(await backgroundsStep(ctx, written.value));
      if ("ending" in backgrounds) return backgrounds.ending;
      const composed = settle(await compositeStep(ctx, backgrounds.value));
      if ("ending" in composed) return composed.ending;
      const checked = settle(await checksStep(ctx, composed.value));
      if ("ending" in checked) return checked.ending;

      const shown: Candidate[] = checked.value;
      return shown.length === 0
        ? { status: "no_pass" }
        : {
            status: "done",
            creatives: creativeRows(shown),
            discard: discardedFiles(composed.value, shown),
          };
    } catch (error) {
      console.error(`round ${run.roundId}: workflow failed`, error);
      return failed("workflow_error");
    }
  };

  const ending = await play();

  if (ending.status !== "abandoned") {
    try {
      await finishRoundStep(run, ending);
    } catch (error) {
      // The round stays running until the deadline rule (or the 60 s rewrite rule) ends it; housekeeping then removes its files.
      console.error(`round ${run.roundId}: finishing failed`, error);
    }
  }

  try {
    await recordCostsStep(run, { costs });
  } catch (error) {
    console.error(`round ${run.roundId}: recording costs failed`, error);
  }
}
