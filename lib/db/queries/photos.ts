import "server-only";
import { z } from "zod";
import { createSecretClient } from "../secret";
import { check } from "./error";

const photoRowSchema = z.object({
  id: z.string(),
  position: z.number(),
  thumb_path: z.string(),
  tier: z.enum(["clean", "clean_low_res", "added_text"]),
  orig_width: z.number(),
  orig_height: z.number(),
  checks: z.object({
    added_text: z.boolean(),
    background: z.enum(["plain", "scene"]),
    person: z.boolean(),
    transparent: z.boolean().default(false),
    gift_set: z.boolean().default(false),
    backdrop_uniform: z.boolean().nullable().default(null),
  }),
  selected: z.boolean(),
});

export type WorkspacePhoto = {
  id: string;
  position: number;
  thumbPath: string;
  tier: "clean" | "clean_low_res" | "added_text";
  origWidth: number;
  origHeight: number;
  background: "plain" | "scene";
  addedText: boolean;
  person: boolean;
  transparent: boolean;
  giftSet: boolean;
  // Whether one colour runs all round the photo's border; null for photos checked before it was measured.
  backdropUniform: boolean | null;
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
      "id, position, thumb_path, tier, orig_width, orig_height, checks, selected, workspaces!inner(user_id)",
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
      id: row.id,
      position: row.position,
      thumbPath: row.thumb_path,
      tier: row.tier,
      origWidth: row.orig_width,
      origHeight: row.orig_height,
      background: row.checks.background,
      addedText: row.checks.added_text,
      person: row.checks.person,
      transparent: row.checks.transparent,
      giftSet: row.checks.gift_set,
      backdropUniform: row.checks.backdrop_uniform,
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

// The first kept photo of each workspace, a selected one when there is one. The owner filter rides on the join.
export async function listCoverThumbs(userId: string, workspaceIds: string[]) {
  const covers = new Map<string, string>();
  if (workspaceIds.length === 0) return covers;
  const { data, error } = await createSecretClient()
    .from("photos")
    .select("workspace_id, thumb_path, workspaces!inner(user_id)")
    .in("workspace_id", workspaceIds)
    .eq("workspaces.user_id", userId)
    .eq("dropped", false)
    .order("selected", { ascending: false })
    .order("position", { ascending: true });
  check(error, "list cover thumbs");
  for (const row of data ?? []) {
    if (row.workspace_id && !covers.has(row.workspace_id)) {
      covers.set(row.workspace_id, row.thumb_path);
    }
  }
  return covers;
}

const bboxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

const roundPhotoRowSchema = z.object({
  id: z.string(),
  sha256: z.string(),
  work_path: z.string(),
  mask_path: z.string().nullable(),
  backdrop_path: z.string().nullable(),
  mask_choice: z.string().nullable(),
  product_bbox: bboxSchema.nullable(),
});

export type RoundPhoto = {
  id: string;
  // Of the original photo, which keys the replayed Fal masks.
  sha256: string;
  workPath: string;
  maskPath: string | null;
  // The cached backdrop mask and the recipe's choice between it and the model's mask; both null until a cut-out first needs them.
  backdropPath: string | null;
  maskChoice: string | null;
  // The product's box as fractions (0 to 1) of the work image.
  productBbox: z.infer<typeof bboxSchema> | null;
};

// One of the workspace's photos for a round's stages. The owner filter rides on the join, so another tester's photo id returns nothing.
export async function getRoundPhoto(
  userId: string,
  workspaceId: string,
  photoId: string,
): Promise<RoundPhoto | null> {
  const { data, error } = await createSecretClient()
    .from("photos")
    .select(
      "id, sha256, work_path, mask_path, backdrop_path, mask_choice, product_bbox, workspaces!inner(user_id)",
    )
    .eq("id", photoId)
    .eq("workspace_id", workspaceId)
    .eq("workspaces.user_id", userId)
    .maybeSingle();
  check(error, "get round photo");
  if (!data) return null;
  const row = roundPhotoRowSchema.parse(data);
  return {
    id: row.id,
    sha256: row.sha256,
    workPath: row.work_path,
    maskPath: row.mask_path,
    backdropPath: row.backdrop_path,
    maskChoice: row.mask_choice,
    productBbox: row.product_bbox,
  };
}

// Written the first time a round cuts a photo out or measures its product, so later rounds reuse them.
export async function setPhotoCutout(
  userId: string,
  workspaceId: string,
  photoId: string,
  cutout: {
    cutoutPath?: string;
    maskPath?: string;
    backdropPath?: string;
    maskChoice?: string;
    productBbox?: NonNullable<RoundPhoto["productBbox"]>;
  },
) {
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
    .update({
      ...(cutout.cutoutPath && { cutout_path: cutout.cutoutPath }),
      ...(cutout.maskPath && { mask_path: cutout.maskPath }),
      ...(cutout.backdropPath && { backdrop_path: cutout.backdropPath }),
      ...(cutout.maskChoice && { mask_choice: cutout.maskChoice }),
      ...(cutout.productBbox && { product_bbox: cutout.productBbox }),
    })
    .eq("id", photoId)
    .eq("workspace_id", workspaceId);
  check(error, "set photo cutout");
}
