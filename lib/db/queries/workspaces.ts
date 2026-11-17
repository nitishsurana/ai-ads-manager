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

export type WorkspaceRow = {
  id: string;
  threadId: string;
  phase: "confirm" | "rounds";
  sourceUrl: string;
  product: Json;
  confirmed: Json;
  campaign: Json;
  brandKit: Json;
  logo: Json;
  updatedAt: string;
};

export async function getWorkspace(
  userId: string,
  id: string,
): Promise<WorkspaceRow | null> {
  const { data, error } = await createSecretClient()
    .from("workspaces")
    .select(
      "id, thread_id, phase, source_url, product, confirmed, campaign, brand_kit, logo, updated_at",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  check(error, "get workspace");
  if (!data) return null;
  return {
    id: data.id,
    threadId: data.thread_id,
    phase: data.phase === "rounds" ? "rounds" : "confirm",
    sourceUrl: data.source_url,
    product: data.product,
    confirmed: data.confirmed,
    campaign: data.campaign,
    brandKit: data.brand_kit,
    logo: data.logo,
    updatedAt: data.updated_at,
  };
}

// Writes only if nobody wrote since `loadedAt` (the updated_at that was read), and returns the new updated_at, or null when it didn't write. The new stamp always differs from the old one.
export async function updateWorkspaceIf(
  userId: string,
  id: string,
  loadedAt: string,
  values: {
    confirmed?: NonNullable<Json>;
    brand_kit?: NonNullable<Json>;
    campaign?: NonNullable<Json>;
  },
) {
  const stamp = new Date(Math.max(Date.now(), Date.parse(loadedAt) + 1));
  const { data, error } = await createSecretClient()
    .from("workspaces")
    .update({ ...values, updated_at: stamp.toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("updated_at", loadedAt)
    .is("deleted_at", null)
    .select("id");
  check(error, "update workspace");
  return data?.length ? stamp.toISOString() : null;
}

export async function getWorkspacePhase(userId: string, id: string) {
  const { data, error } = await createSecretClient()
    .from("workspaces")
    .select("phase")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  check(error, "get workspace phase");
  return data?.phase === "rounds" ? "rounds" : data ? "confirm" : null;
}

export type WorkspaceListItem = Pick<
  WorkspaceRow,
  "id" | "sourceUrl" | "product" | "logo" | "updatedAt"
>;

export async function listWorkspaces(
  userId: string,
): Promise<WorkspaceListItem[]> {
  const { data, error } = await createSecretClient()
    .from("workspaces")
    .select("id, source_url, product, logo, updated_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  check(error, "list workspaces");
  return (data ?? []).map((row) => ({
    id: row.id,
    sourceUrl: row.source_url,
    product: row.product,
    logo: row.logo,
    updatedAt: row.updated_at,
  }));
}

// Soft delete: the row and everything under it stay for the admin. False when this user has no live workspace with that id.
export async function softDeleteWorkspace(userId: string, id: string) {
  const { data, error } = await createSecretClient()
    .from("workspaces")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id");
  check(error, "soft delete workspace");
  return Boolean(data?.length);
}
