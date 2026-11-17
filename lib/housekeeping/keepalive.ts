import "server-only";
import { passwordMatches } from "@/lib/auth";
import { createSecretClient } from "@/lib/db";
import { getEnv } from "@/lib/env";

const EXPORTS_BUCKET = "exports";

// Vercel Cron sends the secret as a bearer token.
export function cronAuthorized(authorization: string | null) {
  return passwordMatches(authorization ?? "", `Bearer ${getEnv().CRON_SECRET}`);
}

// A real query keeps the free Supabase project from pausing; exports are only kept for a day.
export async function keepAlive() {
  const client = createSecretClient();
  const { count, error } = await client
    .from("testers")
    .select("user_id", { count: "exact", head: true });
  if (error) throw new Error(`cron: count testers: ${error.message}`);

  const emptied = await client.storage.emptyBucket(EXPORTS_BUCKET);
  if (emptied.error) {
    console.error("cron: clearing exports failed", emptied.error);
  }
  return { testers: count ?? 0 };
}
