import "server-only";
import { rewriteBriefForRound } from "@/lib/brief";
import {
  setRoundBriefVersion,
  claimRound,
  setRoundDeadline,
} from "@/lib/db/queries";
import { getEnv } from "@/lib/env";
import { roundInputsSchema } from "../inputs";
import {
  checkAndSelect,
  composite,
  makeBackgrounds,
  planCandidates,
  writeCopy,
} from "../stages";
import type { Candidate, RoundContext } from "../types";
import { recordCosts } from "./costs";
import { finishAndClean, type Finish } from "./finish";
import { guardStage } from "./guard";
import { createProgressWriter } from "./progress";
import type { RoundRun, Spend, StageResult } from "./types";

// The queued-to-running claim. A retry would find the round running and look like a lost claim, so it runs once; a failure leaves the round queued for the stale rule.
export async function claimRoundStep(
  run: RoundRun,
): Promise<RoundContext | null> {
  "use step";
  const round = await claimRound(run.userId, run.roundId, new Date());
  if (!round) return null;
  return {
    ...run,
    n: round.n,
    attempt: round.attempt,
    briefVersion: round.briefVersion,
    inputs: roundInputsSchema.parse(round.inputs),
  };
}
claimRoundStep.maxRetries = 0;

// STUB (6a): copies the brief to a new version, once per round number; the Opus rewrite from ratings arrives with Phase 7. It runs once per step, since the real one is paid.
export async function rewriteBriefStep(
  ctx: RoundContext,
): Promise<StageResult<number>> {
  "use step";
  try {
    const version = await rewriteBriefForRound(
      ctx.userId,
      ctx.workspaceId,
      ctx.n,
    );
    const applied =
      version === ctx.briefVersion ||
      (await setRoundBriefVersion(
        ctx.userId,
        ctx.roundId,
        ctx.briefVersion,
        version,
      ));
    return applied
      ? { kind: "ok", value: version, costs: [] }
      : { kind: "abandoned", costs: [] };
  } catch (error) {
    console.error(`round ${ctx.roundId}: brief rewrite failed`, error);
    return { kind: "error", costs: [] };
  }
}
rewriteBriefStep.maxRetries = 0;

// The deadline starts after the rewrite. Returns it, or null when the round is no longer running.
export async function startDeadlineStep(run: RoundRun) {
  "use step";
  const deadline = new Date(Date.now() + getEnv().ROUND_DEADLINE_S * 1000);
  const set = await setRoundDeadline(run.userId, run.roundId, deadline);
  return set ? deadline.getTime() : null;
}
startDeadlineStep.maxRetries = 0;

// The stage steps run once each: a retry would spend again, and an unexpected error is already turned into a failed round.
export async function planStep(
  ctx: RoundContext,
  deadlineAt: number,
): Promise<StageResult<Candidate[]>> {
  "use step";
  const progress = createProgressWriter(ctx, {
    stage: "writing_copy",
    candidates: [],
  });
  return guardStage(ctx, progress, deadlineAt, (deps) =>
    planCandidates(ctx, deps),
  );
}
planStep.maxRetries = 0;

export async function copyStep(
  ctx: RoundContext,
  candidates: Candidate[],
  deadlineAt: number,
): Promise<StageResult<Candidate[]>> {
  "use step";
  const progress = createProgressWriter(ctx, {
    stage: "writing_copy",
    candidates,
  });
  return guardStage(ctx, progress, deadlineAt, (deps) =>
    writeCopy(ctx, candidates, deps),
  );
}
copyStep.maxRetries = 0;

export async function backgroundsStep(
  ctx: RoundContext,
  candidates: Candidate[],
  deadlineAt: number,
): Promise<StageResult<Candidate[]>> {
  "use step";
  const progress = createProgressWriter(ctx, {
    stage: "making_backgrounds",
    candidates,
  });
  return guardStage(ctx, progress, deadlineAt, (deps) =>
    makeBackgrounds(ctx, candidates, deps),
  );
}
backgroundsStep.maxRetries = 0;

export async function compositeStep(
  ctx: RoundContext,
  candidates: Candidate[],
  deadlineAt: number,
): Promise<StageResult<Candidate[]>> {
  "use step";
  const progress = createProgressWriter(ctx, {
    stage: "compositing",
    candidates,
  });
  return guardStage(ctx, progress, deadlineAt, (deps) =>
    composite(ctx, candidates, deps),
  );
}
compositeStep.maxRetries = 0;

export async function checksStep(
  ctx: RoundContext,
  candidates: Candidate[],
  deadlineAt: number,
): Promise<StageResult<Candidate[]>> {
  "use step";
  const progress = createProgressWriter(ctx, {
    stage: "checking_quality",
    candidates,
  });
  return guardStage(ctx, progress, deadlineAt, (deps) =>
    checkAndSelect(ctx, candidates, deps),
  );
}
checksStep.maxRetries = 0;

// Idempotent, so it keeps the default retries. Returns the round's status after the call.
export async function finishRoundStep(run: RoundRun, finish: Finish) {
  "use step";
  return finishAndClean(run, finish);
}

// Costs are best effort and written after the round's terminal state, so they can never undo it.
export async function recordCostsStep(run: RoundRun, spend: Spend) {
  "use step";
  await recordCosts(run, spend);
}
