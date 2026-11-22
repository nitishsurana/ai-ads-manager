import { randomBytes } from "node:crypto";

for (const name of ["SESSION_SECRET", "CRON_SECRET"]) {
  console.log(`${name}=${randomBytes(32).toString("base64")}`);
}
