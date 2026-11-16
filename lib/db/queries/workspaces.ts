import "server-only";
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
