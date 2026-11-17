import "server-only";
import { getRound, type Round } from "@/lib/db/queries";
import { getEnv } from "@/lib/env";
import { messages } from "@/lib/messages";
import { campaignLine } from "./campaign-line";
import { housekeep } from "./housekeeping";
import type { RoundStatusView } from "./schema";
import { progressSchema } from "./types";

const SKELETON_TILES = 3;

const outcomeMessages = {
  failed: messages.round_failed,
  timed_out: messages.round_timed_out,
  no_pass: messages.round_no_pass,
} as const;

export function toStatusView(round: Round): RoundStatusView {
  const progress = progressSchema.safeParse(round.progress).data;
  return {
    id: round.id,
    campaign: campaignLine(round.inputs),
    n: round.n,
    attempt: round.attempt,
    status: round.status,
    stage: round.stage,
    counts: progress?.counts ?? {},
    candidates: (progress?.candidates ?? []).slice(0, SKELETON_TILES),
    message:
      round.status === "failed" ||
      round.status === "timed_out" ||
      round.status === "no_pass"
        ? outcomeMessages[round.status]
        : null,
    runningAt: round.runningAt,
    finishedAt: round.finishedAt,
    retryAt:
      round.status === "timed_out" && round.finishedAt
        ? new Date(
            Date.parse(round.finishedAt) + getEnv().RETRY_WAIT_S * 1000,
          ).toISOString()
        : null,
  };
}

// Applies housekeeping first, so a stuck round is ended by whoever looks at it.
export async function getRoundStatus(userId: string, roundId: string) {
  await housekeep(userId);
  const round = await getRound(userId, roundId);
  return round ? toStatusView(round) : null;
}
