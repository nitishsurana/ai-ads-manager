import "server-only";
import { hasActiveRound, type WorkspaceRow } from "@/lib/db/queries";

// Confirm edits are blocked while a round runs. Every write to the confirm screen's data asks this first.
export async function isLocked(
  userId: string,
  workspace: Pick<WorkspaceRow, "id" | "phase">,
) {
  return workspace.phase === "rounds" && hasActiveRound(userId, workspace.id);
}
