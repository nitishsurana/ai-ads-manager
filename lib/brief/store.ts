import "server-only";
import { parseCampaign } from "@/lib/chat/campaign";
import { loadRows } from "@/lib/chat/rows";
import { confirmedValues } from "@/lib/confirm";
import {
  addBriefVersion,
  getBriefVersion,
  getLatestBrief,
} from "@/lib/db/queries";
import { loadWorkspaceState } from "@/lib/workspace/load";
import {
  briefContentSchema,
  DEFAULT_SETTINGS,
  type BriefContent,
} from "./schema";

type Brief = { version: number; content: BriefContent };

export async function readLatest(userId: string, workspaceId: string) {
  const row = await getLatestBrief(userId, workspaceId);
  return row
    ? { version: row.version, content: briefContentSchema.parse(row.content) }
    : null;
}

// The version a round works from; a missing one is a programming error.
export async function loadBrief(
  userId: string,
  workspaceId: string,
  version: number,
) {
  const row = await getBriefVersion(userId, workspaceId, version);
  if (!row) throw new Error(`brief: version ${version} not found`);
  return briefContentSchema.parse(row.content);
}

// What a brief takes from the workspace as it is now: the campaign, the research the thread collected and the confirmed values.
export async function liveContent(
  userId: string,
  workspaceId: string,
): Promise<Pick<BriefContent, "campaign" | "research" | "values">> {
  const loaded = await loadWorkspaceState(userId, workspaceId);
  if (!loaded) throw new Error(`brief: workspace ${workspaceId} not found`);
  const rows = await loadRows(userId, loaded.workspace.threadId);
  return {
    campaign: parseCampaign(loaded.workspace.campaign),
    research: rows.flatMap((row) =>
      row.kind === "research"
        ? row.parts.flatMap((part) =>
            part.type === "data-research" ? [part.data] : [],
          )
        : [],
    ),
    values: confirmedValues(loaded.state),
  };
}

// Version 1 is created the first time a brief is needed: the first Generate, or the first chat brief change. Losing the race means another caller just created it.
export async function ensureBrief(
  userId: string,
  workspaceId: string,
): Promise<Brief> {
  const existing = await readLatest(userId, workspaceId);
  if (existing) return existing;
  const content: BriefContent = {
    ...(await liveContent(userId, workspaceId)),
    rules: [],
    exemplarCreativeIds: [],
    approvedAngles: [],
    settings: DEFAULT_SETTINGS,
  };
  const version = await addBriefVersion(userId, workspaceId, {
    cause: "initial",
    content,
    baseVersion: 0,
  });
  if (version !== null) return { version, content };
  const created = await readLatest(userId, workspaceId);
  if (!created) throw new Error(`brief: workspace ${workspaceId} has no brief`);
  return created;
}
