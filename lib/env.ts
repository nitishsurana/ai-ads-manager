import "server-only";
import { z } from "zod";

const schema = z
  .object({
    AI_GATEWAY_API_KEY: z.string().min(1),
    FAL_KEY: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    FIRECRAWL_API_KEY: z.string().min(1),
    TESTER_PASSWORD: z.string().min(1),
    SESSION_SECRET: z.string().min(1),
    ADMIN_PASSWORD: z.string().min(1),
    SUPABASE_DB_URL: z.string().min(1),
    SPEND_CAP_USD_DAILY: z.coerce.number().positive().default(5),
    CRON_SECRET: z.string().min(1),
    ROUND_DEADLINE_S: z.coerce.number().int().positive().default(180),
    RETRY_WAIT_S: z.coerce.number().int().positive().default(300),
    STALE_QUEUED_S: z.coerce.number().int().positive().default(30),
    NODE_ENV: z.string().optional(),
    PROVIDERS: z.string().optional(),
  })
  .refine(
    (env) => !(env.NODE_ENV === "production" && env.PROVIDERS === "fake"),
    {
      message: "PROVIDERS=fake is not allowed in production",
    },
  );

type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
