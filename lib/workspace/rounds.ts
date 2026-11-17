import "server-only";
import type { WorkspaceRow } from "@/lib/db/queries";

// Phase 6 answers this from the rounds table: true while a round of the workspace is queued or running.
async function roundInFlight(userId: string, workspaceId: string) {
  void userId;
  void workspaceId;
  return false;
}

// Confirm edits are blocked while a round runs. Every write to the confirm screen's data asks this first.
export async function isLocked(
  userId: string,
  workspace: Pick<WorkspaceRow, "id" | "phase">,
) {
  return workspace.phase === "rounds" && roundInFlight(userId, workspace.id);
}
