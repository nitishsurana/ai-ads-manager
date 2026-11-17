import "server-only";
import { start } from "workflow/api";
import { ensureBrief } from "@/lib/brief";
import type { ConfirmState } from "@/lib/confirm";
import { ROUND_DAILY_LIMIT } from "@/lib/config";
import {
  countRoundsRunningSince,
  countUnratedCreatives,
  failQueuedRound,
  getLatestRound,
  listFacts,
  startRoundRow,
} from "@/lib/db/queries";
import { getEnv } from "@/lib/env";
import { spendCapReached } from "@/lib/limits";
import { loadWorkspaceState } from "@/lib/workspace/load";
import type { Result } from "@/lib/workspace/result";
import { housekeep } from "./housekeeping";
import { freezeInputs } from "./inputs";
import { nextRound } from "./next";
import { roundWorkflow } from "./workflow";

const isActive = (status: string) =>
  status === "queued" || status === "running";

function utcDayStart(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

// The only way a round begins (generate.ts calls it with the state commitConfirmed just saved). Checks run in the spec's order; a second call while a round is active returns that round, so a double click starts one.
export async function startRound(
  userId: string,
  workspaceId: string,
  committed: { state: ConfirmState; updatedAt: string },
): Promise<Result<{ roundId: string }>> {
  await housekeep(userId);
  const latest = await getLatestRound(userId, workspaceId);
  if (latest && isActive(latest.status)) {
    return { ok: true, roundId: latest.id };
  }

  const now = new Date();
  const next = nextRound(latest, now, getEnv().RETRY_WAIT_S);
  if (next.kind === "wait") return { ok: false, code: "retry_wait" };
  if (
    next.ratedCheck &&
    (await countUnratedCreatives(userId, next.ratedCheck)) > 0
  ) {
    return { ok: false, code: "unrated" };
  }
  if (
    (await countRoundsRunningSince(userId, utcDayStart(now))) >=
    ROUND_DAILY_LIMIT
  ) {
    return { ok: false, code: "daily_limit" };
  }
  if (await spendCapReached()) return { ok: false, code: "spend_cap" };

  const loaded = await loadWorkspaceState(userId, workspaceId);
  if (!loaded) return { ok: false, code: "not_found" };
  // Retries reuse their round's brief version; a new round starts from the latest.
  const briefVersion =
    latest && next.attempt > 1
      ? latest.briefVersion
      : (await ensureBrief(userId, workspaceId)).version;
  const inputs = freezeInputs({
    title: loaded.title,
    workspace: loaded.workspace,
    state: committed.state,
    photos: loaded.photos,
    facts: await listFacts(userId, loaded.workspace.threadId),
  });

  const started = await startRoundRow(userId, workspaceId, {
    updatedAt: committed.updatedAt,
    n: next.n,
    attempt: next.attempt,
    briefVersion,
    inputs,
    now,
  });
  if (started.kind === "conflict") {
    const current = await getLatestRound(userId, workspaceId);
    return current && isActive(current.status)
      ? { ok: true, roundId: current.id }
      : { ok: false, code: "save_failed" };
  }
  if (started.kind === "stale") return { ok: false, code: "save_failed" };

  const { roundId } = started;
  try {
    await start(roundWorkflow, [{ userId, workspaceId, roundId }]);
  } catch (error) {
    // The round shows its failure and offers a retry; it never ran, so it doesn't count toward the daily limit.
    console.error(`round ${roundId}: starting the workflow failed`, error);
    await failQueuedRound(userId, roundId, new Date());
  }
  return { ok: true, roundId };
}
