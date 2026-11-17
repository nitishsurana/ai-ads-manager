import "server-only";
import { startRound } from "@/lib/round";
import type { Result } from "./result";
import { commitConfirmed } from "./save";

export async function generateCreatives(
  userId: string,
  workspaceId: string,
): Promise<Result<{ roundId: string }>> {
  const committed = await commitConfirmed(userId, workspaceId);
  if (!committed.ok) return committed;
  return startRound(userId, workspaceId, committed);
}

// Edit mode after round 1: the same checks and the same save, without starting a round.
export async function saveChanges(
  userId: string,
  workspaceId: string,
): Promise<Result> {
  const committed = await commitConfirmed(userId, workspaceId);
  return committed.ok ? { ok: true } : committed;
}
