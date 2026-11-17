import "server-only";
import {
  findOpenThreadId,
  createThread,
  getLatestBrief,
  getLatestIntake,
  getLatestRound,
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

const STATUS = {
  empty: "New workspace",
  reading: "Reading…",
  failed: "Couldn’t read link",
  confirm: "Step 1 · Confirm",
} as const;

// A workspace's chat follows its latest round: making it, or rating it with the brief it was made from.
async function workspaceMode(userId: string, workspaceId: string) {
  if ((await getWorkspacePhase(userId, workspaceId)) !== "rounds") {
    return { mode: "confirm" as const, status: STATUS.confirm };
  }
  const [round, brief] = await Promise.all([
    getLatestRound(userId, workspaceId),
    getLatestBrief(userId, workspaceId),
  ]);
  if (!round) return { mode: "confirm" as const, status: STATUS.confirm };
  return round.status === "queued" || round.status === "running"
    ? { mode: "generating" as const, status: `Round ${round.n} · making` }
    : {
        mode: "round" as const,
        status: `Round ${round.n} · brief v${brief?.version ?? round.briefVersion}`,
      };
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

  const { mode, status }: { mode: ChatMode; status: string } =
    thread.workspaceId
      ? await workspaceMode(userId, thread.workspaceId)
      : intake?.status === "reading"
        ? { mode: "reading", status: STATUS.reading }
        : intake?.status === "failed"
          ? { mode: "failed", status: STATUS.failed }
          : { mode: "empty", status: STATUS.empty };
  return {
    rows,
    facts,
    campaign,
    mode,
    status,
    confirmHref: thread.workspaceId
      ? await confirmHref(userId, thread.workspaceId)
      : null,
  };
}
