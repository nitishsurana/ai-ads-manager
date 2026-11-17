import "server-only";
import {
  getCreative,
  getLatestRound,
  getRound,
  hasActiveRound,
  writeCreativeIf,
} from "@/lib/db/queries";
import type { RoundResult } from "../result";
import { hasReason, type Rating } from "./tags";

type RatingInput = {
  creativeId: string;
  rev: number;
  rating: Rating | null;
  tags: string[];
  note: string;
};

// The creative, if it is the caller's and in the workspace's latest round; null for anything else.
export async function ownedCreative(
  userId: string,
  workspaceId: string,
  creativeId: string,
) {
  const creative = await getCreative(userId, creativeId);
  if (!creative) return null;
  const round = await getRound(userId, creative.roundId);
  if (round?.workspaceId !== workspaceId) return null;
  const latest = await getLatestRound(userId, workspaceId);
  return latest?.id === round.id ? { creative, round } : null;
}

// Saved only while no round runs and only at the rev the tester saw; clearing the rating records "reject chosen, no reason yet".
export async function rateCreative(
  userId: string,
  workspaceId: string,
  input: RatingInput,
): Promise<RoundResult<{ rev: number }>> {
  const owned = await ownedCreative(userId, workspaceId, input.creativeId);
  if (!owned) return { ok: false, code: "not_found" };
  if (await hasActiveRound(userId, workspaceId)) {
    return { ok: false, code: "round_running" };
  }
  const note = input.note.trim();
  if (input.rating === "reject" && !hasReason(input.tags, note)) {
    return { ok: false, code: "reject_reason_required" };
  }
  const rev = await writeCreativeIf(userId, input.creativeId, input.rev, {
    rating: input.rating,
    tags: input.rating === "reject" ? input.tags : [],
    note: input.rating && note ? note : null,
  });
  return rev === null
    ? { ok: false, code: "creative_changed" }
    : { ok: true, rev };
}
