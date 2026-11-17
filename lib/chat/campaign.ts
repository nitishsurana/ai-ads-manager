import "server-only";
import { z } from "zod";
import {
  getThread,
  getWorkspaceCampaign,
  setThreadCampaign,
  setWorkspaceCampaign,
  type Thread,
} from "@/lib/db/queries";

const field = z.string().trim().min(1).max(80);

export const campaignPatchSchema = z.object({
  occasion: field.optional(),
  angle: field.optional(),
  audience: field.optional(),
});

export type Campaign = z.infer<typeof campaignPatchSchema>;

const CAMPAIGN_KEYS = ["occasion", "angle", "audience"] as const;

const labels = {
  occasion: "Occasion",
  angle: "Angle",
  audience: "Audience",
} as const;

function parseCampaign(json: unknown): Campaign {
  return campaignPatchSchema.catch({}).parse(json);
}

// The thread holds the campaign until a workspace exists; from then on the workspace is the single copy.
export async function readCampaign(userId: string, thread: Thread) {
  return parseCampaign(
    thread.workspaceId
      ? await getWorkspaceCampaign(userId, thread.workspaceId)
      : thread.campaign,
  );
}

// The thread is read again: an intake started in this turn may have made it a workspace since the turn began.
export async function mergeCampaign(
  userId: string,
  threadId: string,
  patch: Campaign,
) {
  const thread = await getThread(userId, threadId);
  if (!thread) throw new Error(`chat: thread ${threadId} not found`);
  const next = { ...(await readCampaign(userId, thread)), ...patch };
  if (thread.workspaceId) {
    await setWorkspaceCampaign(userId, thread.workspaceId, next);
  } else {
    await setThreadCampaign(userId, thread.id, next);
  }
  return CAMPAIGN_KEYS.flatMap((key) => {
    const text = patch[key];
    return text ? [{ label: labels[key], text }] : [];
  });
}
