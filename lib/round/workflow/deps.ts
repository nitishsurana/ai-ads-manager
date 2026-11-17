import "server-only";
import { loadBrief } from "@/lib/brief";
import { getEnv } from "@/lib/env";
import { createRealAi, createScriptedAi } from "@/lib/providers/ai";
import type { CostEntry } from "@/lib/intake";
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
    costs: CostEntry[];
  },
): StageDeps {
  const fault = faultFor(ctx.inputs);
  const ai =
    process.env.PROVIDERS === "fake"
      ? createScriptedAi({
          fault: fault === "slow" || fault === "fail" ? fault : null,
          slowMs: getEnv().ROUND_DEADLINE_S * 1000 + 1_500,
        })
      : createRealAi();
  const storage = createStorage();
  const guardedStorage: Storage = {
    ...storage,
    async put(...args) {
      if (options.isAbandoned()) throw new RoundAbandonedError(ctx.roundId);
      return storage.put(...args);
    },
  };
  return {
    ai: {
      async generate(request) {
        const entry = {
          provider: "ai" as const,
          model: request.model,
          task: request.task,
        };
        try {
          const result = await ai.generate(request);
          options.costs.push({ ...entry, usd: result.costUsd });
          return result;
        } catch (error) {
          // The call may still have been billed; the amount is unknown.
          options.costs.push({ ...entry, usd: null });
          throw error;
        }
      },
    },
    storage: guardedStorage,
    brief: () => loadBrief(ctx.userId, ctx.workspaceId, ctx.briefVersion),
    progress: options.progress,
    fault,
  };
}
