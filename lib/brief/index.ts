import "server-only";
import { randomUUID } from "node:crypto";
import { parseCampaign } from "@/lib/chat/campaign";
import { loadRows } from "@/lib/chat/rows";
import { confirmedValues } from "@/lib/confirm";
import {
  addBriefVersion,
  findRoundBriefVersion,
  getLatestBrief,
} from "@/lib/db/queries";
import { retryOnMiss } from "@/lib/workspace/cas";
import { loadWorkspaceState } from "@/lib/workspace/load";
import {
  briefContentSchema,
  type BriefContent,
  type BriefRule,
} from "./schema";

export type { BriefContent, BriefRule } from "./schema";

type Brief = { version: number; content: BriefContent };

async function readLatest(userId: string, workspaceId: string) {
  const row = await getLatestBrief(userId, workspaceId);
  return row
    ? { version: row.version, content: briefContentSchema.parse(row.content) }
    : null;
}

// Built from the confirmed values, the workspace's campaign and the research the thread collected.
async function initialContent(
  userId: string,
  workspaceId: string,
): Promise<BriefContent> {
  const loaded = await loadWorkspaceState(userId, workspaceId);
  if (!loaded) throw new Error(`brief: workspace ${workspaceId} not found`);
  const rows = await loadRows(userId, loaded.workspace.threadId);
  return {
    rules: [],
    campaign: parseCampaign(loaded.workspace.campaign),
    research: rows.flatMap((row) =>
      row.kind === "research"
        ? row.parts.flatMap((part) =>
            part.type === "data-research" ? [part.data] : [],
          )
        : [],
    ),
    values: confirmedValues(loaded.state),
    exemplarCreativeIds: [],
    approvedAngles: [],
  };
}

// Version 1 is created the first time a brief is needed: the first Generate, or the first chat brief change. Losing the race means another caller just created it.
export async function ensureBrief(
  userId: string,
  workspaceId: string,
): Promise<Brief> {
  const existing = await readLatest(userId, workspaceId);
  if (existing) return existing;
  const content = await initialContent(userId, workspaceId);
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

const MAX_RULES = 20;

const ruleKey = (rule: { kind: string; text: string }) =>
  `${rule.kind}:${rule.text.toLowerCase()}`;

// Identical rules are dropped, and a brief keeps at most MAX_RULES.
function freshRules(
  existing: BriefRule[],
  proposed: { kind: "do" | "dont"; text: string }[],
) {
  const seen = new Set(existing.map(ruleKey));
  const fresh = proposed.filter((rule) => {
    const key = ruleKey(rule);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return fresh.slice(0, Math.max(0, MAX_RULES - existing.length));
}

// Returns the rules that were actually added; nothing new means no new version.
export async function proposeBriefChange(
  userId: string,
  workspaceId: string,
  rules: { kind: "do" | "dont"; text: string }[],
) {
  let added: BriefRule[] = [];
  const version = await retryOnMiss(async () => {
    const latest = await ensureBrief(userId, workspaceId);
    added = freshRules(latest.content.rules, rules).map((rule) => ({
      ...rule,
      id: randomUUID(),
      source: "chat" as const,
      locked: false,
    }));
    if (added.length === 0) return latest.version;
    return addBriefVersion(userId, workspaceId, {
      cause: "chat",
      content: {
        ...latest.content,
        rules: [...latest.content.rules, ...added],
      },
      baseVersion: latest.version,
    });
  });
  if (version === null) {
    throw new Error(`brief: workspace ${workspaceId} kept changing`);
  }
  return added;
}

// STUB (6a): the rewrite from ratings arrives with Phase 7; until then the next round starts from a copy. It runs on the first attempt of round n that reaches it; later attempts reuse that version.
export async function rewriteBriefForRound(
  userId: string,
  workspaceId: string,
  n: number,
) {
  const existing = await findRoundBriefVersion(userId, workspaceId, n);
  if (existing !== null) return existing;
  const version = await retryOnMiss(async () => {
    const latest = await ensureBrief(userId, workspaceId);
    return addBriefVersion(userId, workspaceId, {
      cause: "round",
      content: { ...latest.content, round: n },
      baseVersion: latest.version,
    });
  });
  if (version === null) {
    throw new Error(`brief: workspace ${workspaceId} kept changing`);
  }
  return version;
}
