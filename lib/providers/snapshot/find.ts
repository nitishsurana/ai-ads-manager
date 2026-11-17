import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readSnapshotJson, SnapshotError } from "./read";
import { caseSchema } from "./schemas";

const ROOTS = [".golden", join("golden", "fixtures")];

// Replay mode (PROVIDERS=fake) serves an intake from the snapshot recorded for its URL: .golden/<ID> first, then the committed fixtures, each in name order, so a URL shared by several fixtures resolves to the first.
export function snapshotDirForUrl(url: string) {
  if (process.env.PROVIDERS !== "fake") return undefined;
  for (const root of ROOTS) {
    if (!existsSync(/*turbopackIgnore: true*/ root)) continue;
    for (const name of readdirSync(/*turbopackIgnore: true*/ root).sort()) {
      const dir = join(/*turbopackIgnore: true*/ root, name);
      if (!existsSync(/*turbopackIgnore: true*/ join(dir, "case.json")))
        continue;
      if (readSnapshotJson(dir, "case.json", caseSchema).url === url) {
        return dir;
      }
    }
  }
  throw new SnapshotError(`no snapshot is recorded for ${url}`);
}
