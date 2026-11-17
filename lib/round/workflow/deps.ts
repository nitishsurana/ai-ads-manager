import "server-only";
import { getEnv } from "@/lib/env";
import { createSecretClient } from "@/lib/db/secret";
import { createSupabaseStorage } from "@/lib/providers/storage";
import type { Storage } from "@/lib/providers/storage";
import { faultFor } from "../fake";
import type { ProgressEvent, StageDeps } from "../stages";
import type { RoundContext } from "../types";
import { RoundAbandonedError } from "./errors";

export function createStorage() {
  return createSupabaseStorage(createSecretClient());
}

export function createStepDeps(
  ctx: RoundContext,
  options: {
    progress: (event: ProgressEvent) => Promise<void>;
    isAbandoned: () => boolean;
  },
): StageDeps {
  const storage = createStorage();
  const guardedStorage: Storage = {
    ...storage,
    async put(...args) {
      if (options.isAbandoned()) throw new RoundAbandonedError(ctx.roundId);
      return storage.put(...args);
    },
  };
  return {
    storage: guardedStorage,
    progress: options.progress,
    fault: faultFor(ctx.inputs),
    slowMs: getEnv().ROUND_DEADLINE_S * 1000 + 1_500,
  };
}
