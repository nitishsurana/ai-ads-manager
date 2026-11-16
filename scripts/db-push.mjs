import { execFileSync } from "node:child_process";

process.loadEnvFile(".env.local");

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL is not set");

try {
  execFileSync(
    "npx",
    ["supabase", "db", "push", `--remote=${url}`, ...process.argv.slice(2)],
    {
      stdio: "inherit",
    },
  );
} catch {
  process.exit(1);
}
