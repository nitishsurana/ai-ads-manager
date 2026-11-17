import "server-only";
import { cache } from "react";
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

// Memoised per render, so one refresh of the chat pane reads each thread once.
export const getThread = cache(async function getThread(
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
});

export async function findOpenThreadId(userId: string) {
  const { data, error } = await createSecretClient()
    .from("threads")
    .select("id")
    .eq("user_id", userId)
    .is("workspace_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  check(error, "find open thread");
  return data?.id ?? null;
}

export async function setThreadCampaign(
  userId: string,
  id: string,
  campaign: NonNullable<Json>,
) {
  const { error } = await createSecretClient()
    .from("threads")
    .update({ campaign })
    .eq("id", id)
    .eq("user_id", userId);
  check(error, "set thread campaign");
}

export async function deleteThread(userId: string, id: string) {
  const { error } = await createSecretClient()
    .from("threads")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  check(error, "delete thread");
}
