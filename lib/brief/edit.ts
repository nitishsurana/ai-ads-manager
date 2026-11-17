import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { addBriefVersion, hasActiveRound } from "@/lib/db/queries";
import type { RoundResult } from "@/lib/round/result";
import { ruleKey } from "./rules";
import {
  briefRuleSchema,
  MAX_RULES,
  withoutRound,
  type BriefRule,
} from "./schema";
import { readLatest } from "./store";

export const briefEditSchema = z.object({
  baseVersion: z.number().int().positive(),
  rules: z
    .array(
      z.object({
        id: z.string().optional(),
        kind: briefRuleSchema.shape.kind,
        text: briefRuleSchema.shape.text,
      }),
    )
    .max(MAX_RULES),
});

export type BriefEdit = z.infer<typeof briefEditSchema>;

// The tester's rule list replaces the brief's; new or changed rules become locked tester edits.
export async function saveBriefRules(
  userId: string,
  workspaceId: string,
  edit: BriefEdit,
): Promise<RoundResult<{ version: number }>> {
  if (await hasActiveRound(userId, workspaceId)) {
    return { ok: false, code: "round_running" };
  }
  const latest = await readLatest(userId, workspaceId);
  if (!latest) return { ok: false, code: "not_found" };
  if (latest.version !== edit.baseVersion) {
    return { ok: false, code: "brief_changed" };
  }

  const known = new Map(latest.content.rules.map((rule) => [rule.id, rule]));
  const seen = new Set<string>();
  const rules: BriefRule[] = [];
  for (const proposed of edit.rules) {
    const key = ruleKey(proposed);
    if (seen.has(key)) continue;
    seen.add(key);
    const current = proposed.id ? known.get(proposed.id) : undefined;
    rules.push(
      current && ruleKey(current) === key
        ? current
        : {
            id: randomUUID(),
            kind: proposed.kind,
            text: proposed.text,
            source: "tester_edit",
            locked: true,
          },
    );
  }
  const unchanged =
    rules.length === latest.content.rules.length &&
    rules.every((rule, index) => rule === latest.content.rules[index]);
  if (unchanged) return { ok: true, version: latest.version };

  const version = await addBriefVersion(userId, workspaceId, {
    cause: "tester_edit",
    content: { ...withoutRound(latest.content), rules },
    baseVersion: latest.version,
  });
  return version === null
    ? { ok: false, code: "brief_changed" }
    : { ok: true, version };
}
