import "server-only";
import { z } from "zod";
import type { Json } from "../database.types";
import { createSecretClient } from "../secret";
import { check } from "./error";

const briefRowSchema = z.object({ version: z.number(), content: z.unknown() });

export type BriefRow = z.infer<typeof briefRowSchema>;

export async function getLatestBrief(
  userId: string,
  workspaceId: string,
): Promise<BriefRow | null> {
  const { data, error } = await createSecretClient()
    .from("briefs")
    .select("version, content")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  check(error, "get latest brief");
  return data ? briefRowSchema.parse(data) : null;
}

export async function getBriefVersion(
  userId: string,
  workspaceId: string,
  version: number,
): Promise<BriefRow | null> {
  const { data, error } = await createSecretClient()
    .from("briefs")
    .select("version, content")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("version", version)
    .maybeSingle();
  check(error, "get brief version");
  return data ? briefRowSchema.parse(data) : null;
}

// The version the rewrite for round n created, if it already ran.
export async function findRoundBriefVersion(
  userId: string,
  workspaceId: string,
  n: number,
) {
  const { data, error } = await createSecretClient()
    .from("briefs")
    .select("version")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("cause", "round")
    .eq("content->>round", String(n))
    .maybeSingle();
  check(error, "find round brief");
  return data?.version ?? null;
}

// Appends a version only if the latest is still baseVersion (0 when there is none); returns the new version, or null when someone wrote first.
export async function addBriefVersion(
  userId: string,
  workspaceId: string,
  input: {
    cause: "initial" | "chat" | "round" | "tester_edit";
    content: NonNullable<Json>;
    baseVersion: number;
  },
) {
  const { data, error } = await createSecretClient().rpc("add_brief_version", {
    p_user_id: userId,
    p_workspace_id: workspaceId,
    p_cause: input.cause,
    p_content: input.content,
    p_base_version: input.baseVersion,
  });
  check(error, "add brief version");
  return z.number().nullable().parse(data);
}

// Every version's cause and (for a round's rewrite) the round it belongs to, oldest first.
export async function listBriefVersions(userId: string, workspaceId: string) {
  const { data, error } = await createSecretClient()
    .from("briefs")
    .select("version, cause, content->round")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("version", { ascending: true });
  check(error, "list brief versions");
  return z
    .array(
      z.object({
        version: z.number(),
        cause: z.enum(["initial", "chat", "round", "tester_edit"]),
        round: z.number().nullable(),
      }),
    )
    .parse(data ?? []);
}
