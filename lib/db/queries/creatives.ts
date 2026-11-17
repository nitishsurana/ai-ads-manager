import "server-only";
import { z } from "zod";
import type { Json } from "../database.types";
import { createSecretClient } from "../secret";
import { check } from "./error";

const creativeRowSchema = z.object({
  id: z.string(),
  round_id: z.string(),
  n: z.number(),
  angle: z.string(),
  photo_id: z.string().nullable(),
  supporting_element: z.enum(["price", "rating", "offer"]).nullable(),
  background: z.unknown(),
  copy: z.unknown(),
  layout: z.unknown(),
  background_path: z.string().nullable(),
  preview_path: z.string(),
  rating: z.enum(["approve", "reject"]).nullable(),
  tags: z.array(z.string()),
  note: z.string().nullable(),
  edits: z.unknown(),
  rev: z.number(),
});

const COLUMNS =
  "id, round_id, n, angle, photo_id, supporting_element, background, copy, layout, background_path, preview_path, rating, tags, note, edits, rev";

export type RoundCreative = {
  id: string;
  roundId: string;
  n: number;
  angle: string;
  photoId: string | null;
  supportingElement: "price" | "rating" | "offer" | null;
  background: unknown;
  copy: unknown;
  layout: unknown;
  backgroundPath: string | null;
  previewPath: string;
  rating: "approve" | "reject" | null;
  tags: string[];
  note: string | null;
  edits: unknown;
  rev: number;
};

function toCreative(row: unknown): RoundCreative {
  const parsed = creativeRowSchema.parse(row);
  return {
    id: parsed.id,
    roundId: parsed.round_id,
    n: parsed.n,
    angle: parsed.angle,
    photoId: parsed.photo_id,
    supportingElement: parsed.supporting_element,
    background: parsed.background,
    copy: parsed.copy,
    layout: parsed.layout,
    backgroundPath: parsed.background_path,
    previewPath: parsed.preview_path,
    rating: parsed.rating,
    tags: parsed.tags,
    note: parsed.note,
    edits: parsed.edits,
    rev: parsed.rev,
  };
}

export async function listRoundCreatives(
  userId: string,
  roundId: string,
): Promise<RoundCreative[]> {
  const { data, error } = await createSecretClient()
    .from("creatives")
    .select(COLUMNS)
    .eq("round_id", roundId)
    .eq("user_id", userId)
    .order("n", { ascending: true });
  check(error, "list creatives");
  return (data ?? []).map(toCreative);
}

export async function listCreativesOfRounds(
  userId: string,
  roundIds: string[],
): Promise<RoundCreative[]> {
  if (roundIds.length === 0) return [];
  const { data, error } = await createSecretClient()
    .from("creatives")
    .select(COLUMNS)
    .in("round_id", roundIds)
    .eq("user_id", userId)
    .order("n", { ascending: true });
  check(error, "list creatives of rounds");
  return (data ?? []).map(toCreative);
}

export async function getCreative(userId: string, id: string) {
  const { data, error } = await createSecretClient()
    .from("creatives")
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  check(error, "get creative");
  return data ? toCreative(data) : null;
}

export async function countUnratedCreatives(userId: string, roundId: string) {
  const { count, error } = await createSecretClient()
    .from("creatives")
    .select("id", { count: "exact", head: true })
    .eq("round_id", roundId)
    .eq("user_id", userId)
    .is("rating", null);
  check(error, "count unrated creatives");
  return count ?? 0;
}

export type CreativeWrite = {
  rating?: "approve" | "reject" | null;
  tags?: string[];
  note?: string | null;
  copy?: NonNullable<Json>;
  layout?: NonNullable<Json>;
  preview_path?: string;
  edits?: NonNullable<Json>;
};

// Writes only if the creative is still at `rev` (the one the caller read) and bumps it; returns the new rev, or null when someone wrote first.
export async function writeCreativeIf(
  userId: string,
  id: string,
  rev: number,
  values: CreativeWrite,
) {
  const { data, error } = await createSecretClient()
    .from("creatives")
    .update({ ...values, rev: rev + 1 })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("rev", rev)
    .select("rev");
  check(error, "write creative");
  return data?.[0]?.rev ?? null;
}
