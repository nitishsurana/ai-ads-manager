import type { Http } from "@/lib/providers/http";
import { createReplayFal } from "./fake";
import { createRealFal } from "./real";
import type { Fal } from "./types";

export type { Fal, FalMaskRequest } from "./types";
export { createRealFal };

export function createFal(options: { http: Http; snapshotDir?: string }): Fal {
  if (process.env.PROVIDERS !== "fake") {
    return createRealFal({ http: options.http });
  }
  if (!options.snapshotDir) throw new Error("fal: replay needs a snapshotDir");
  return createReplayFal(options.snapshotDir);
}
