import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import type { Database } from "./database.types";

let cached: ReturnType<typeof create> | undefined;

function create() {
  const env = getEnv();

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function createSecretClient() {
  cached ??= create();
  return cached;
}
