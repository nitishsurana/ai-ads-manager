import "server-only";
import { z } from "zod";
import { createSecretClient } from "../secret";
import { check } from "./error";

const photoRowSchema = z.object({
  position: z.number(),
  thumb_path: z.string(),
  tier: z.enum(["clean", "clean_low_res", "added_text"]),
  orig_width: z.number(),
  orig_height: z.number(),
  checks: z.object({
    added_text: z.boolean(),
    background: z.enum(["plain", "scene"]),
  }),
  selected: z.boolean(),
});

export type WorkspacePhoto = {
  position: number;
  thumbPath: string;
  tier: "clean" | "clean_low_res" | "added_text";
  origWidth: number;
  origHeight: number;
  background: "plain" | "scene";
  addedText: boolean;
  selected: boolean;
};

// The workspace's own kept photos. The owner filter rides on the join, so another tester's id returns nothing.
export async function listWorkspacePhotos(
  userId: string,
  workspaceId: string,
): Promise<WorkspacePhoto[]> {
  const { data, error } = await createSecretClient()
    .from("photos")
    .select(
      "position, thumb_path, tier, orig_width, orig_height, checks, selected, workspaces!inner(user_id)",
    )
    .eq("workspace_id", workspaceId)
    .eq("workspaces.user_id", userId)
    .eq("dropped", false)
    .order("position", { ascending: true });
  check(error, "list workspace photos");
  return z
    .array(photoRowSchema)
    .parse(data ?? [])
    .map((row) => ({
      position: row.position,
      thumbPath: row.thumb_path,
      tier: row.tier,
      origWidth: row.orig_width,
      origHeight: row.orig_height,
      background: row.checks.background,
      addedText: row.checks.added_text,
      selected: row.selected,
    }));
}

export async function setPhotosSelected(
  userId: string,
  workspaceId: string,
  positions: number[],
  selected: boolean,
) {
  if (positions.length === 0) return;
  const client = createSecretClient();
  const { data: owned, error: ownerError } = await client
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  check(ownerError, "check workspace owner");
  if (!owned)
    throw new Error(`db: workspace ${workspaceId} not found for user`);
  const { error } = await client
    .from("photos")
    .update({ selected })
    .eq("workspace_id", workspaceId)
    .in("position", positions)
    .eq("dropped", false);
  check(error, "set photos selected");
}
