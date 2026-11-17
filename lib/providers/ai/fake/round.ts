import { ANGLES } from "@/lib/round/types";
import type { Ai } from "../types";

const HEADLINES = [
  "Made to be used daily",
  "Quietly built to last",
  "Simple, honest, well made",
  "Everyday comfort, upgraded",
  "A closer look at the details",
  "Designed for real life",
];

// Answers the round's tasks without a model, for the end-to-end tests. The plan ignores the rules on purpose (empty photo ids, no elements), so the code that enforces them runs on every round. Every background is a Bria scene, so each round makes a fake Fal call.
export function createScriptedAi(): Ai {
  return {
    async generate<T>(request: { task: string }) {
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
        background: {
          method: "bria",
          scenePrompt: "A calm sunlit table with soft shadows",
          reason: "fake",
        },
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
