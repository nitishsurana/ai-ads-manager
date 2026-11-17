import "server-only";
import { loadBrief } from "@/lib/brief";
import { BRIA_EDIT_USD, REGENERATION_RESERVE_SHARE } from "@/lib/config";
import { createSecretClient } from "@/lib/db/secret";
import { getRoundPhoto, setPhotoCutout } from "@/lib/db/queries";
import { getEnv } from "@/lib/env";
import { MASK_MODEL, type CostEntry } from "@/lib/intake";
import { createRealAi, createScriptedAi, type Ai } from "@/lib/providers/ai";
import { createReadBack, intendedReadback } from "../checks/readback";
import { createRealDns } from "@/lib/providers/dns";
import {
  createRealFal,
  EDIT_MODEL,
  createScriptedFal,
  type Fal,
} from "@/lib/providers/fal";
import {
  createFontReplayHttp,
  createRealHttp,
  FONT_FIXTURES,
} from "@/lib/providers/http";
import { createSupabaseStorage } from "@/lib/providers/storage";
import type { Storage } from "@/lib/providers/storage";
import { scenarioFor } from "../fake";
import type { ProgressEvent, RoundPhotos, StageDeps } from "../stages";
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
    deadlineAt: number;
  },
): StageDeps {
  const scenario = scenarioFor(ctx.inputs);
  const fake = process.env.PROVIDERS === "fake";
  const ai = fake ? createScriptedAi({ scenario }) : createRealAi();
  const http = fake
    ? createFontReplayHttp(FONT_FIXTURES)
    : createRealHttp({ dns: createRealDns() });
  const fal = fake
    ? createScriptedFal({
        fault:
          scenario === "slow" || scenario === "fail" || scenario === "l1_fail"
            ? scenario
            : null,
        slowMs: getEnv().ROUND_DEADLINE_S * 1000 + 1_500,
      })
    : createRealFal({ http });
  const storage = createStorage();
  const guardedStorage: Storage = {
    ...storage,
    async put(...args) {
      if (options.isAbandoned()) throw new RoundAbandonedError(ctx.roundId);
      return storage.put(...args);
    },
  };
  const costedAi: Ai = {
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
  };
  return {
    ai: costedAi,
    readBack: fake
      ? async (_png, layout) => intendedReadback(layout)
      : createReadBack({ ai: costedAi }),
    fal: costedFal(fal, options.costs),
    http,
    storage: guardedStorage,
    photos: roundPhotos(ctx),
    brief: () => loadBrief(ctx.userId, ctx.workspaceId, ctx.briefVersion),
    progress: options.progress,
    regenerateUntil:
      options.deadlineAt -
      getEnv().ROUND_DEADLINE_S * 1000 * REGENERATION_RESERVE_SHARE,
  };
}

// A call that fails may still have been billed; the amount is unknown then.
function costedFal(fal: Fal, costs: CostEntry[]): Fal {
  async function record<T>(
    model: string,
    task: string,
    usd: number | null,
    call: () => Promise<T>,
  ) {
    try {
      const result = await call();
      costs.push({ provider: "fal", model, usd, task });
      return result;
    } catch (error) {
      costs.push({ provider: "fal", model, usd: null, task });
      throw error;
    }
  }
  return {
    backgroundMask: (request) =>
      record(MASK_MODEL, "cutout", null, () => fal.backgroundMask(request)),
    backgroundEdit: (request) =>
      record(EDIT_MODEL, "background", BRIA_EDIT_USD, () =>
        fal.backgroundEdit(request),
      ),
  };
}

function roundPhotos(ctx: RoundContext): RoundPhotos {
  return {
    async get(photoId) {
      const photo = await getRoundPhoto(ctx.userId, ctx.workspaceId, photoId);
      if (!photo)
        throw new Error(`round ${ctx.roundId}: photo ${photoId} not found`);
      return photo;
    },
    setCutout: (photoId, cutout) =>
      setPhotoCutout(ctx.userId, ctx.workspaceId, photoId, cutout),
  };
}
