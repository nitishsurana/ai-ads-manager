import "server-only";
import {
  getWorkspaceThreadId,
  listBriefVersions,
  listFacts,
} from "@/lib/db/queries";
import type { BriefContent } from "./schema";
import { readLatest } from "./store";

export type BriefVersionLabel = {
  version: number;
  cause: "initial" | "chat" | "round" | "tester_edit";
  round: number | null;
};

export type BriefPanelData = {
  version: number;
  content: BriefContent;
  versions: BriefVersionLabel[];
  facts: { text: string; status: "pending" | "confirmed" }[];
};

// What the brief panel shows: the latest version, the history of versions, and the thread's facts with their status.
export async function loadBriefPanel(
  userId: string,
  workspaceId: string,
): Promise<BriefPanelData | null> {
  const [latest, versions, threadId] = await Promise.all([
    readLatest(userId, workspaceId),
    listBriefVersions(userId, workspaceId),
    getWorkspaceThreadId(userId, workspaceId),
  ]);
  if (!latest || !threadId) return null;
  const facts = await listFacts(userId, threadId);
  return {
    version: latest.version,
    content: latest.content,
    versions,
    facts: facts.map(({ text, status }) => ({ text, status })),
  };
}
