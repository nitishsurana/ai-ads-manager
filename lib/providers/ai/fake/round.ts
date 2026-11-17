import { setTimeout as sleep } from "node:timers/promises";
import { ANGLES } from "@/lib/round/types";
import type { Ai } from "../types";

export type RoundFault = "slow" | "fail";

const HEADLINES = [
  "Made to be used daily",
  "Quietly built to last",
  "Simple, honest, well made",
  "Everyday comfort, upgraded",
  "A closer look at the details",
  "Designed for real life",
];

// Answers the round's tasks without a model, for the end-to-end tests. The plan ignores the rules on purpose (empty photo ids, no elements), so the code that enforces them runs on every round. Faults make the art direction call slow or fail.
export function createScriptedAi(options: {
  fault: RoundFault | null;
  slowMs: number;
}): Ai {
  return {
    async generate<T>(request: { task: string }) {
      if (request.task === "art_direction") {
        if (options.fault === "fail") {
          throw new Error("fake fault: art direction failed");
        }
        if (options.fault === "slow") await sleep(options.slowMs);
      }
      return { object: scripted(request.task) as T, costUsd: null };
    },
  };
}

function scripted(task: string) {
  if (task === "art_direction") {
    return {
      candidates: ANGLES.map((angle) => ({
        angle,
        photoId: "",
        element: "none",
        offerFactId: null,
        background: { method: "tonal", scenePrompt: null, reason: "fake" },
      })),
    };
  }
  if (task === "copy" || task === "copy_rewrite") {
    return {
      candidates: HEADLINES.map((headline, index) => ({
        index,
        eyebrow: null,
        headline,
        cta: "Shop now",
      })),
    };
  }
  throw new Error(`fake ai: no script for task ${task}`);
}
