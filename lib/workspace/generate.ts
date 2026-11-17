import "server-only";
import type { ConfirmState } from "@/lib/confirm";
import type { Result } from "./result";
import { commitConfirmed } from "./save";

// Phase 6 replaces the body: it freezes the confirmed values into rounds.inputs, inserts the round and starts its workflow. This is the only place a round begins from the confirm screen.
async function startRound(
  userId: string,
  workspaceId: string,
  committed: { state: ConfirmState; updatedAt: string },
): Promise<Result> {
  void userId;
  void workspaceId;
  void committed;
  return { ok: true };
}

export async function generateCreatives(
  userId: string,
  workspaceId: string,
): Promise<Result> {
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
