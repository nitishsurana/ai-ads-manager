import "server-only";
import type { Json } from "../database.types";
import { createSecretClient } from "../secret";
import { check } from "./error";

export async function findWorkspaceByProductKey(
  userId: string,
  productKey: string,
) {
  const { data, error } = await createSecretClient()
    .from("workspaces")
    .select("id")
    .eq("user_id", userId)
    .eq("product_key", productKey)
    .is("deleted_at", null)
    .maybeSingle();
  check(error, "find workspace");
  return data?.id ?? null;
}

export async function getWorkspaceCampaign(userId: string, id: string) {
  const { data, error } = await createSecretClient()
    .from("workspaces")
    .select("campaign")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  check(error, "get workspace campaign");
  return data?.campaign ?? null;
}

export async function setWorkspaceCampaign(
  userId: string,
  id: string,
  campaign: NonNullable<Json>,
) {
  const { error } = await createSecretClient()
    .from("workspaces")
    .update({ campaign, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  check(error, "set workspace campaign");
}

export async function getWorkspaceThreadId(userId: string, id: string) {
  const { data, error } = await createSecretClient()
    .from("workspaces")
    .select("thread_id")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  check(error, "get workspace thread");
  return data?.thread_id ?? null;
}
