import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BriefContent } from "@/lib/brief/schema";
import type { Ai } from "@/lib/providers/ai";
import { createLocalStorage } from "@/lib/providers/storage";
import type { RoundInputs } from "@/lib/round/inputs";
import {
  composite,
  makeBackgrounds,
  planCandidates,
  writeCopy,
  type StageDeps,
} from "@/lib/round/stages";
import type { Candidate, RoundContext } from "@/lib/round/types";

export function roundContext(name: string, inputs: RoundInputs): RoundContext {
  return {
    userId: "golden",
    workspaceId: name,
    roundId: name,
    n: 1,
    attempt: 1,
    briefVersion: 1,
    inputs,
  };
}

const unused = (what: string) => () => {
  throw new Error(`golden: ${what} is not used by this run`);
};

// Plan and copy for one round, the way the workflow's steps call them.
export async function runStages(
  name: string,
  inputs: RoundInputs,
  brief: BriefContent,
  ai: Ai,
) {
  const dir = mkdtempSync(join(tmpdir(), "golden-round-"));
  try {
    const ctx = roundContext(name, inputs);
    const deps: StageDeps = {
      ai,
      fal: { backgroundMask: unused("fal"), backgroundEdit: unused("fal") },
      http: { get: unused("http") },
      storage: createLocalStorage(dir),
      photos: { get: unused("photos"), setCutout: unused("photos") },
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

// Backgrounds and the text layer for candidates that already have copy, with the providers the caller chose.
export async function runRender(
  name: string,
  inputs: RoundInputs,
  candidates: Candidate[],
  deps: Omit<StageDeps, "ai" | "brief" | "progress" | "fault">,
): Promise<Candidate[]> {
  const full: StageDeps = {
    ...deps,
    ai: { generate: unused("ai") },
    brief: unused("brief"),
    progress: async () => {},
    fault: null,
  };
  const ctx = roundContext(name, inputs);
  const backgrounds = await makeBackgrounds(ctx, candidates, full);
  return composite(ctx, backgrounds, full);
}
