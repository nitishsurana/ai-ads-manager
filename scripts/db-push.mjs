import { execFileSync } from "node:child_process";

process.loadEnvFile(".env.local");

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL is not set");
// The CLI reads anything else as a project ref or branch name and fails with an unrelated linking error.
if (!/^postgres(ql)?:\/\//.test(url)) {
  throw new Error(
    "SUPABASE_DB_URL must be a Postgres connection string (postgresql://…): Project Settings > Database > Session pooler",
  );
}

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
