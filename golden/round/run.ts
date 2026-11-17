import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BriefContent } from "@/lib/brief/schema";
import type { Ai } from "@/lib/providers/ai";
import { createLocalStorage } from "@/lib/providers/storage";
import type { RoundInputs } from "@/lib/round/inputs";
import { planCandidates, writeCopy } from "@/lib/round/stages";
import type { RoundContext } from "@/lib/round/types";

// Plan and copy for one round, the way the workflow's steps call them.
export async function runStages(
  name: string,
  inputs: RoundInputs,
  brief: BriefContent,
  ai: Ai,
) {
  const dir = mkdtempSync(join(tmpdir(), "golden-round-"));
  try {
    const ctx: RoundContext = {
      userId: "golden",
      workspaceId: name,
      roundId: name,
      n: 1,
      attempt: 1,
      briefVersion: 1,
      inputs,
    };
    const deps = {
      ai,
      storage: createLocalStorage(dir),
      brief: async () => brief,
      progress: async () => {},
      fault: null,
    };
    const planned = await planCandidates(ctx, deps);
    const copied = await writeCopy(ctx, planned, deps);
    return { planned, copied };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
