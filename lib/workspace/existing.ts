import "server-only";
import {
  getIntake,
  getThread,
  getWorkspaceCampaign,
  getWorkspaceThreadId,
  moveFactPending,
  removeFact,
  upsertMessage,
  listFacts,
} from "@/lib/db/queries";
import { parseCampaign, type Campaign } from "@/lib/chat/campaign";

const LABELS = [
  ["occasion", "Occasion"],
  ["angle", "Angle"],
  ["audience", "Audience"],
] as const;

// A suggestion lists only what differs from the workspace's campaign.
function suggestion(proposed: Campaign, current: Campaign) {
  const lines = LABELS.flatMap(([key, label]) =>
    proposed[key] && proposed[key] !== current[key]
      ? [`${label}: ${proposed[key]}`]
      : [],
  );
  return lines.length === 0
    ? null
    : `You also mentioned a campaign in your last message: ${lines.join("; ")}. I haven't applied it. Tell me here if you want this workspace to use it.`;
}

// The new thread's facts move to the workspace's thread as pending (so one the tester later removes or edits is never merged again), and its campaign is offered in chat, not applied. Both are safe to repeat: a fact already there is dropped from the source, and the message has a fixed id and is replaced by a later merge.
export async function mergeIntoExisting(
  run: { userId: string; threadId: string; intakeId: string },
  workspaceId: string,
) {
  const { userId } = run;
  const targetId = await getWorkspaceThreadId(userId, workspaceId);
  if (!targetId || targetId === run.threadId) return;

  // A source thread that became a workspace keeps its own facts.
  const thread = await getThread(userId, run.threadId);
  if (!thread || thread.workspaceId) return;

  const [incoming, known, current] = await Promise.all([
    listFacts(userId, run.threadId),
    listFacts(userId, targetId),
    getWorkspaceCampaign(userId, workspaceId),
  ]);
  const have = new Set(known.map((fact) => fact.text.toLowerCase()));
  for (const fact of incoming) {
    if (have.has(fact.text.toLowerCase())) {
      await removeFact(userId, run.threadId, fact.id);
      continue;
    }
    have.add(fact.text.toLowerCase());
    await moveFactPending(userId, run.threadId, targetId, fact.id);
  }

  const text = suggestion(
    parseCampaign(thread.campaign),
    parseCampaign(current),
  );
  if (!text) return;
  await upsertMessage(userId, {
    threadId: targetId,
    uiId: `intake-${run.intakeId}-campaign`,
    role: "assistant",
    kind: "chat",
    parts: [{ type: "text", text }],
  });
}

// The intake can finish before the model's tools have recorded this message's facts and campaign, so the chat turn repeats the merge once it ends. A new workspace is built from its own thread, which the merge skips.
export async function mergeFinishedIntake(
  userId: string,
  threadId: string,
  intakeId: string,
) {
  const intake = await getIntake(userId, intakeId);
  if (intake?.status !== "done" || !intake.workspaceId) return;
  await mergeIntoExisting({ userId, threadId, intakeId }, intake.workspaceId);
}
