import "server-only";
import type { Database } from "../database.types";
import { createSecretClient } from "../secret";
import { check } from "./error";

export type NewCost = Pick<
  Database["public"]["Tables"]["costs"]["Insert"],
  "provider" | "model" | "usd" | "meta"
>;

// The intake's costs are written once, in one step, so a retry replaces them instead of doubling them.
export async function replaceIntakeCosts(
  userId: string,
  intakeId: string,
  workspaceId: string | null,
  costs: NewCost[],
) {
  const client = createSecretClient();
  const { error: deleteError } = await client
    .from("costs")
    .delete()
    .eq("user_id", userId)
    .eq("intake_id", intakeId);
  check(deleteError, "delete intake costs");
  if (costs.length === 0) return;
  const { error } = await client.from("costs").insert(
    costs.map((cost) => ({
      ...cost,
      user_id: userId,
      intake_id: intakeId,
      workspace_id: workspaceId,
    })),
  );
  check(error, "insert intake costs");
}

export async function insertCosts(
  userId: string,
  workspaceId: string | null,
  costs: NewCost[],
) {
  if (costs.length === 0) return;
  const { error } = await createSecretClient()
    .from("costs")
    .insert(
      costs.map((cost) => ({
        ...cost,
        user_id: userId,
        workspace_id: workspaceId,
      })),
    );
  check(error, "insert costs");
}
