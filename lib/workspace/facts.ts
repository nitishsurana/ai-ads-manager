import "server-only";
import {
  confirmFact,
  editFact,
  getWorkspaceThreadId,
  getWorkspacePhase,
  removeFact,
} from "@/lib/db/queries";
import type { Result } from "./result";
import { isLocked } from "./rounds";

// A fact belongs to the workspace's thread; anything else, or anyone else's workspace, is not found.
async function onFact(
  userId: string,
  workspaceId: string,
  write: (threadId: string) => Promise<boolean>,
): Promise<Result> {
  const [threadId, phase] = await Promise.all([
    getWorkspaceThreadId(userId, workspaceId),
    getWorkspacePhase(userId, workspaceId),
  ]);
  if (!threadId || !phase) return { ok: false, code: "not_found" };
  if (await isLocked(userId, { id: workspaceId, phase })) {
    return { ok: false, code: "confirm_locked" };
  }
  return (await write(threadId))
    ? { ok: true }
    : { ok: false, code: "not_found" };
}

export const setFactConfirmed = (
  userId: string,
  workspaceId: string,
  factId: string,
) =>
  onFact(userId, workspaceId, (threadId) =>
    confirmFact(userId, threadId, factId),
  );

export const rewriteFact = (
  userId: string,
  workspaceId: string,
  factId: string,
  text: string,
) =>
  onFact(userId, workspaceId, (threadId) =>
    editFact(userId, threadId, factId, text),
  );

export const deleteFact = (
  userId: string,
  workspaceId: string,
  factId: string,
) =>
  onFact(userId, workspaceId, (threadId) =>
    removeFact(userId, threadId, factId),
  );
