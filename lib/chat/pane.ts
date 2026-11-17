import "server-only";
import {
  findOpenThreadId,
  createThread,
  getLatestIntake,
  getThread,
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
  return { rows, facts, campaign, mode };
}
