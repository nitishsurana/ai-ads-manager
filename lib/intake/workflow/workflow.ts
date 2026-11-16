import type { Step1FailureCode } from "@/lib/messages";
import type { CostEntry } from "../photos";
import type { IntakeResult } from "../types";
import {
  persistExistingStep,
  persistFailureStep,
  persistSuccessStep,
  readBrandStep,
  readProductStep,
  recordCostsStep,
} from "./steps";
import type { IntakeRun } from "./types";

type Ending =
  | { kind: "success"; result: IntakeResult }
  | { kind: "existing"; workspaceId: string }
  | { kind: "failed"; code: Step1FailureCode }
  | { kind: "abandoned" }
  | { kind: "done"; workspaceId: string | null };

const failed = (): Ending => ({ kind: "failed", code: "intake_failed" });

export async function intakeWorkflow(run: IntakeRun) {
  "use workflow";

  const costs: CostEntry[] = [];
  const firecrawlRenders: string[] = [];
  const pastDeadline = () => Date.now() > run.deadlineAt;
  const add = (spend: { costs: CostEntry[]; firecrawlRenders: string[] }) => {
    costs.push(...spend.costs);
    firecrawlRenders.push(...spend.firecrawlRenders);
  };

  const read = async (): Promise<Ending> => {
    try {
      const product = await readProductStep(run);
      add(product);
      if (product.kind === "error") return failed();
      if (product.kind === "abandoned") return { kind: "abandoned" };
      const outcome = product.value;
      if (!outcome.ok) return { kind: "failed", code: outcome.code };
      if ("existingWorkspaceId" in outcome) {
        return { kind: "existing", workspaceId: outcome.existingWorkspaceId };
      }
      if (pastDeadline()) return failed();

      const brand = await readBrandStep(run, outcome);
      add(brand);
      if (brand.kind === "error") return failed();
      if (brand.kind === "abandoned") return { kind: "abandoned" };
      if (pastDeadline()) return failed();
      return { kind: "success", result: brand.value };
    } catch (error) {
      console.error(`intake ${run.intakeId}: workflow failed`, error);
      return failed();
    }
  };

  let ending = await read();

  if (ending.kind === "success" || ending.kind === "existing") {
    try {
      const persisted =
        ending.kind === "success"
          ? await persistSuccessStep(run, ending.result)
          : await persistExistingStep(run, ending.workspaceId);
      ending = { kind: "done", workspaceId: persisted.workspaceId };
    } catch (error) {
      console.error(`intake ${run.intakeId}: persisting failed`, error);
      ending = failed();
    }
  }

  if (ending.kind === "failed") {
    try {
      await persistFailureStep(run, ending.code);
    } catch (error) {
      // The next read of the intake heals the cleanup.
      console.error(`intake ${run.intakeId}: failure cleanup failed`, error);
    }
  }

  // Whatever the outcome; the write replaces, so repeating it is safe, and it can't undo anything.
  try {
    await recordCostsStep(
      run,
      ending.kind === "done" ? ending.workspaceId : null,
      {
        costs,
        firecrawlRenders,
      },
    );
  } catch (error) {
    console.error(`intake ${run.intakeId}: recording costs failed`, error);
  }
}
