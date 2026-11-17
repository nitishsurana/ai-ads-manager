import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReadBack } from "@/lib/round/checks/readback";
import type { BriefContent } from "@/lib/brief/schema";
import { REGENERATION_RESERVE_SHARE } from "@/lib/config";
import type { Ai } from "@/lib/providers/ai";
import { createLocalStorage } from "@/lib/providers/storage";
import type { RoundInputs } from "@/lib/round/inputs";
import {
  checkAndSelect,
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

// The round's own deadline, so regeneration decisions match a real round.
const DEADLINE_MS = 180_000;
const regenerateUntil = (started: number) =>
  started + DEADLINE_MS * (1 - REGENERATION_RESERVE_SHARE);

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
      readBack: unused("readBack"),
      progress: async () => {},
      regenerateUntil: regenerateUntil(Date.now()),
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
  deps: Omit<
    StageDeps,
    "ai" | "brief" | "progress" | "regenerateUntil" | "readBack"
  >,
): Promise<Candidate[]> {
  const full: StageDeps = {
    ...deps,
    ai: { generate: unused("ai") },
    brief: unused("brief"),
    readBack: unused("readBack"),
    progress: async () => {},
    regenerateUntil: regenerateUntil(Date.now()),
  };
  const ctx = roundContext(name, inputs);
  const backgrounds = await makeBackgrounds(ctx, candidates, full);
  return composite(ctx, backgrounds, full);
}

// The whole round the way the workflow's steps run it: plan, copy, backgrounds, text layer, then checks, judge and selection. Returns what each stage left, the creatives to show, and how long it took.
export async function runRound(
  name: string,
  inputs: RoundInputs,
  brief: BriefContent,
  deps: Omit<StageDeps, "brief" | "progress" | "regenerateUntil" | "readBack">,
  attempt = 1,
) {
  const started = Date.now();
  const full: StageDeps = {
    ...deps,
    readBack: createReadBack(deps),
    brief: async () => brief,
    progress: async () => {},
    regenerateUntil: regenerateUntil(started),
  };
  const ctx = { ...roundContext(name, inputs), attempt };
  const planned = await planCandidates(ctx, full);
  const plannedAt = Date.now();
  const copied = await writeCopy(ctx, planned, full);
  const timings = {
    planMs: plannedAt - started,
    copyMs: Date.now() - plannedAt,
  };
  if (copied.length === 0) {
    return {
      planned,
      copied,
      shown: [] as Candidate[],
      timings,
      elapsedMs: Date.now() - started,
    };
  }
  const backgrounds = await makeBackgrounds(ctx, copied, full);
  const composed = await composite(ctx, backgrounds, full);
  const shown = await checkAndSelect(ctx, composed, full);
  return { planned, copied, shown, timings, elapsedMs: Date.now() - started };
}
