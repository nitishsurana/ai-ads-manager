import "server-only";
import type { Json } from "../database.types";
import { createSecretClient } from "../secret";
import { check } from "./error";

export type Thread = {
  id: string;
  workspaceId: string | null;
  campaign: NonNullable<Json>;
};

export async function createThread(userId: string) {
  const { data, error } = await createSecretClient()
    .from("threads")
    .insert({ user_id: userId })
    .select("id")
    .single();
  check(error, "create thread");
  if (!data) throw new Error("db: create thread returned no row");
  return data.id;
}

export async function getThread(
  userId: string,
  id: string,
): Promise<Thread | null> {
  const { data, error } = await createSecretClient()
    .from("threads")
    .select("id, workspace_id, campaign")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  check(error, "get thread");
  return data
    ? { id: data.id, workspaceId: data.workspace_id, campaign: data.campaign }
    : null;
}
