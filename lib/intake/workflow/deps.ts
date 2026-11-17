import "server-only";
import { createSecretClient } from "@/lib/db/secret";
import { findWorkspaceByProductKey } from "@/lib/db/queries";
import { snapshotDirForUrl } from "@/lib/providers/snapshot";
import { createSupabaseStorage } from "@/lib/providers/storage";
import type { Storage } from "@/lib/providers/storage";
import { createIntakeDeps } from "../deps";
import { MASK_MODEL, type CostEntry } from "../photos";
import type { IntakeProgress } from "../types";
import { IntakeAbandonedError } from "./errors";
import type { IntakeRun } from "./types";

export function createStorage() {
  return createSupabaseStorage(createSecretClient());
}

// The guard owns the spend, so it survives whatever a stage throws: every model call, mask and render that came back is recorded here (one Firecrawl credit per render).
export function createStepDeps(
  run: IntakeRun,
  options: {
    progress: (event: IntakeProgress) => Promise<void>;
    isAbandoned: () => boolean;
    costs: CostEntry[];
    renders: string[];
  },
) {
  const { costs, renders } = options;
  const storage = createStorage();
  const guardedStorage: Storage = {
    ...storage,
    async put(...args) {
      if (options.isAbandoned()) throw new IntakeAbandonedError(run.intakeId);
      return storage.put(...args);
    },
  };
  const deps = createIntakeDeps({
    findWorkspace: (productKey) =>
      findWorkspaceByProductKey(run.userId, productKey),
    storage: guardedStorage,
    progress: options.progress,
    snapshotDir: snapshotDirForUrl(run.url),
  });
  return {
    ...deps,
    ai: {
      async generate(request) {
        const result = await deps.ai.generate(request);
        costs.push({
          provider: "ai",
          model: request.model,
          usd: result.costUsd,
        });
        return result;
      },
    },
    fal: {
      async backgroundMask(request) {
        const mask = await deps.fal.backgroundMask(request);
        costs.push({ provider: "fal", model: MASK_MODEL, usd: null });
        return mask;
      },
    },
    firecrawl: {
      async scrapePage(url, scrapeOptions) {
        const page = await deps.firecrawl.scrapePage(url, scrapeOptions);
        renders.push(url);
        return page;
      },
    },
  } satisfies typeof deps;
}
