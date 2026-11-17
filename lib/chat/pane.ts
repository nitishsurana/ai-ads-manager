import "server-only";
import {
  findOpenThreadId,
  createThread,
  getLatestIntake,
  getThread,
  getWorkspacePhase,
  listFacts,
} from "@/lib/db/queries";
import { readIntake } from "@/lib/intake/workflow";
import { readCampaign } from "./campaign";
import { loadRows } from "./rows";
import type { ChatMode } from "./types";

// The Empty screen's thread: the newest one that hasn't become a workspace, or a fresh one.
export async function ensureCurrentThread(userId: string) {
  return (await findOpenThreadId(userId)) ?? createThread(userId);
}

// Where a pending fact is confirmed: the facts card of the confirm screen, which is its own route once rounds exist.
async function confirmHref(userId: string, workspaceId: string) {
  return (await getWorkspacePhase(userId, workspaceId)) === "rounds"
    ? `/w/${workspaceId}/confirm#facts`
    : `/w/${workspaceId}#facts`;
}

export async function loadChatPane(userId: string, threadId: string) {
  const thread = await getThread(userId, threadId);
  if (!thread) return null;

  const [rows, facts, campaign, latest] = await Promise.all([
    loadRows(userId, threadId),
    listFacts(userId, threadId),
    readCampaign(userId, thread),
    getLatestIntake(userId, threadId),
  ]);
  // A reading intake is read through readIntake so the stuck rule applies on every refresh.
  const intake =
    latest?.status === "reading"
      ? ((await readIntake(userId, latest.id)) ?? latest)
      : latest;

  const mode: ChatMode = thread.workspaceId
    ? "confirm"
    : intake?.status === "reading"
      ? "reading"
      : intake?.status === "failed"
        ? "failed"
        : "empty";
  return {
    rows,
    facts,
    campaign,
    mode,
    confirmHref: thread.workspaceId
      ? await confirmHref(userId, thread.workspaceId)
      : null,
  };
}
