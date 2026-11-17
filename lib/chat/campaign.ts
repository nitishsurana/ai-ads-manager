import "server-only";
import { campaignPatchSchema, type Campaign } from "./campaign-schema";
import { retryOnMiss } from "@/lib/workspace/cas";
import {
  getThread,
  getWorkspace,
  getWorkspaceCampaign,
  setThreadCampaign,
  updateWorkspaceIf,
  type Thread,
} from "@/lib/db/queries";

export { campaignPatchSchema, type Campaign };

const CAMPAIGN_KEYS = ["occasion", "angle", "audience"] as const;

const labels = {
  occasion: "Occasion",
  angle: "Angle",
  audience: "Audience",
} as const;

export function parseCampaign(json: unknown): Campaign {
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

// Only the fields the tool set are merged, into the campaign as it is now, and written only if nothing wrote since it was read.
async function patchWorkspaceCampaign(
  userId: string,
  workspaceId: string,
  patch: Campaign,
) {
  const saved = await retryOnMiss(async () => {
    const workspace = await getWorkspace(userId, workspaceId);
    if (!workspace) throw new Error(`chat: workspace ${workspaceId} not found`);
    const campaign = { ...parseCampaign(workspace.campaign), ...patch };
    return (await updateWorkspaceIf(userId, workspaceId, workspace.updatedAt, {
      campaign,
    }))
      ? true
      : null;
  });
  if (!saved) {
    throw new Error(`chat: campaign of workspace ${workspaceId} kept changing`);
  }
}

// The thread is read again: an intake started in this turn may have made it a workspace since the turn began.
export async function mergeCampaign(
  userId: string,
  threadId: string,
  patch: Campaign,
) {
  const thread = await getThread(userId, threadId);
  if (!thread) throw new Error(`chat: thread ${threadId} not found`);
  if (thread.workspaceId) {
    await patchWorkspaceCampaign(userId, thread.workspaceId, patch);
  } else {
    await setThreadCampaign(userId, thread.id, {
      ...(await readCampaign(userId, thread)),
      ...patch,
    });
  }
  return CAMPAIGN_KEYS.flatMap((key) => {
    const text = patch[key];
    return text ? [{ label: labels[key], text }] : [];
  });
}
