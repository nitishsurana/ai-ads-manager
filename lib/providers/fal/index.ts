import type { Http } from "@/lib/providers/http";
import { createReplayFal } from "./fake";
import { createRealFal } from "./real";
import type { Fal } from "./types";

export type { Fal, FalEditRequest, FalMaskRequest } from "./types";
export { createRealFal };
export { EDIT_MODEL, MASK_MODEL } from "./models";
export { createReplayFal, editSnapshotKey } from "./fake";
export { createScriptedFal, type FalFault } from "./fake/scripted";

export function createFal(options: {
  http: Http;
  snapshotDir?: string | string[];
}): Fal {
  if (process.env.PROVIDERS !== "fake") {
    return createRealFal({ http: options.http });
  }
  if (!options.snapshotDir) throw new Error("fal: replay needs a snapshotDir");
  return createReplayFal(...[options.snapshotDir].flat());
}
