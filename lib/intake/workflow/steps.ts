import "server-only";
import type { Step1FailureCode } from "@/lib/messages";
import { runIntakeBrand, runIntakeUntilBrand } from "../pipeline";
import type {
  IntakeResult,
  UntilBrandOutcome,
  UntilBrandReady,
} from "../types";
import { failAndCleanUp } from "./cleanup";
import { recordCosts } from "./costs";
import { guardStage } from "./guard";
import { createProgressWriter } from "./progress";
import { persistExisting, persistSuccess } from "./success";
import type { IntakeRun, Spend, StageResult } from "./types";

// The two paid steps run once: a retry would spend again, and an unexpected error is already turned into a failed intake.
export async function readProductStep(
  run: IntakeRun,
): Promise<StageResult<UntilBrandOutcome>> {
  "use step";
  return guardStage(run, createProgressWriter(run), (deps) =>
    runIntakeUntilBrand({ url: run.url, intakeId: run.intakeId }, deps),
  );
}
readProductStep.maxRetries = 0;

export async function readBrandStep(
  run: IntakeRun,
  ready: UntilBrandReady,
): Promise<StageResult<IntakeResult>> {
  "use step";
  const thumbs = ready.result.photos.photos
    .filter((photo) => photo.selected)
    .map(({ position, thumbPath }) => ({ position, thumbPath }));
  const progress = createProgressWriter(run, {
    photos: thumbs,
    product: {
      title: ready.result.product.title,
      price: ready.result.page.price,
    },
  });
  return guardStage(run, progress, async (deps) => {
    await progress.setStage("brand");
    return runIntakeBrand(
      { url: run.url, intakeId: run.intakeId },
      ready,
      deps,
    );
  });
}
readBrandStep.maxRetries = 0;

// The persistence steps are idempotent, so they keep the default retries.
export async function persistSuccessStep(run: IntakeRun, result: IntakeResult) {
  "use step";
  return persistSuccess(run, result);
}

export async function persistExistingStep(
  run: IntakeRun,
  existingWorkspaceId: string,
) {
  "use step";
  return persistExisting(run, existingWorkspaceId);
}

// False when the intake was already done and nothing was touched.
export async function persistFailureStep(
  run: IntakeRun,
  code: Step1FailureCode,
) {
  "use step";
  return failAndCleanUp(run, code);
}

// Costs are best effort and written after the intake's terminal state, so they can never undo it.
export async function recordCostsStep(
  run: IntakeRun,
  workspaceId: string | null,
  spend: Spend,
) {
  "use step";
  await recordCosts(run, workspaceId, spend);
}
