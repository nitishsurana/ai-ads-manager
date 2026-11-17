import { createReplayAi } from "./fake";
import { createFakeResearcher } from "./fake/research";
import { createRealAi } from "./real";
import { createRealResearcher } from "./research";
import type { Ai, Researcher } from "./types";

export type {
  Ai,
  AiRequest,
  AiResult,
  ResearchCost,
  ResearchResult,
  Researcher,
} from "./types";
export { aiSnapshotKey } from "./key";
export { CHAT_MODEL, createChatModel } from "./chat-model";
export { gatewayCostUsd } from "./cost";
export { createRealAi };
export { createScriptedAi, type RoundFault } from "./fake/round";

export function createResearcher(): Researcher {
  return process.env.PROVIDERS === "fake"
    ? createFakeResearcher()
    : createRealResearcher();
}

export function createAi(options: { snapshotDir?: string } = {}): Ai {
  if (process.env.PROVIDERS !== "fake") return createRealAi();
  if (!options.snapshotDir) throw new Error("ai: replay needs a snapshotDir");
  return createReplayAi(options.snapshotDir);
}
