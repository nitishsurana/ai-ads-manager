import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type IntakeResult,
  createIntakeDeps,
  runIntake,
  runIntakeUntilBrand,
} from "@/lib/intake";
import {
  caseSchema,
  firecrawlSnapshotSchema,
  readSnapshotJson,
} from "@/lib/providers/snapshot";
import { createLocalStorage, type Storage } from "@/lib/providers/storage";
import type { Outcome } from "./observe";
import { stubBrand } from "./stub-brand";

// Rows recorded before the brand stage have no homepage page to replay; their expectations carry no brand fields, so they run the stages up to photos only.
export function hasBrandPages(dir: string) {
  const file = join(dir, "firecrawl.json");
  if (!existsSync(file)) return false;
  const pages = Object.keys(
    readSnapshotJson(dir, "firecrawl.json", firecrawlSnapshotSchema),
  );
  return pages.some((page) =>
    /^\/([a-z]{2}(-[a-z]{2})?\/)?$/i.test(new URL(page).pathname),
  );
}

export function snapshotDirOf(name: string) {
  return [join(".golden", name), join("golden", "fixtures", name)].find((dir) =>
    existsSync(join(dir, "case.json")),
  );
}

// A row recorded before the brand stage gets a stub brand, so its confirm scenarios still run.
export function fullResult(outcome: Outcome): IntakeResult | null {
  if (!outcome.ok || !("result" in outcome)) return null;
  return "brand" in outcome.result
    ? outcome.result
    : { ...outcome.result, brand: stubBrand };
}

// Step 1 of a row, replayed from its snapshot. A caller that passes `storage` keeps the photos and logo it writes.
export async function replayIntake(
  name: string,
  dir: string,
  storage?: Storage,
) {
  const { url } = readSnapshotJson(dir, "case.json", caseSchema);
  const storageDir = storage ? null : mkdtempSync(join(tmpdir(), "golden-"));
  try {
    const deps = createIntakeDeps({
      snapshotDir: dir,
      storage: storage ?? createLocalStorage(storageDir ?? ""),
      findWorkspace: async () => null,
    });
    const run = hasBrandPages(dir) ? runIntake : runIntakeUntilBrand;
    const result = fullResult(await run({ url, intakeId: name }, deps));
    if (!result) throw new Error(`${name}: step 1 produced no result`);
    return result;
  } finally {
    if (storageDir) rmSync(storageDir, { recursive: true, force: true });
  }
}
