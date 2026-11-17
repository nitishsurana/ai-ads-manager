import "server-only";
import { createSecretClient } from "../secret";
import { check } from "./error";

export type RoundCreative = {
  n: number;
  angle: string;
  previewPath: string;
  rating: string | null;
};

export async function listRoundCreatives(
  userId: string,
  roundId: string,
): Promise<RoundCreative[]> {
  const { data, error } = await createSecretClient()
    .from("creatives")
    .select("n, angle, preview_path, rating")
    .eq("round_id", roundId)
    .eq("user_id", userId)
    .order("n", { ascending: true });
  check(error, "list creatives");
  return (data ?? []).map((row) => ({
    n: row.n,
    angle: row.angle,
    previewPath: row.preview_path,
    rating: row.rating,
  }));
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
