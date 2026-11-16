import { createReplayAi } from "./fake";
import { createRealAi } from "./real";
import type { Ai } from "./types";

export type { Ai, AiRequest, AiResult } from "./types";
export { aiSnapshotKey } from "./key";
export { createRealAi };

export function createAi(options: { snapshotDir?: string } = {}): Ai {
  if (process.env.PROVIDERS !== "fake") return createRealAi();
  if (!options.snapshotDir) throw new Error("ai: replay needs a snapshotDir");
  return createReplayAi(options.snapshotDir);
}
