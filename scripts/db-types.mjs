import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

process.loadEnvFile(".env.local");

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL is not set");

try {
  const types = execFileSync(
    "npx",
    [
      "supabase",
      "gen",
      "types",
      "typescript",
      `--db-url=${url}`,
      "--schema=public",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  writeFileSync("lib/db/database.types.ts", types);
} catch {
  process.exit(1);
}
