import "server-only";
import { randomUUID } from "node:crypto";
import { addBriefVersion } from "@/lib/db/queries";
import { retryOnMiss } from "@/lib/workspace/cas";
import { MAX_RULES, withoutRound, type BriefRule } from "./schema";
import { ruleKey } from "./rules";
import { ensureBrief } from "./store";

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
        ...withoutRound(latest.content),
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
