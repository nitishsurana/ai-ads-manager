import { CRITERIA } from "@/lib/round/judge/schema";
import type { Scenario } from "@/lib/round/fake";
import { ANGLES } from "@/lib/round/types";
import type { Ai, AiRequest } from "../types";

const HEADLINES = [
  "Made to be used daily",
  "Quietly built to last",
  "Simple, honest, well made",
  "Everyday comfort, upgraded",
  "A closer look inside",
  "Designed for real life",
];

type Judged = { index: number; element: string | null };

// A score for every criterion of one judged creative, from the scenario. Sonnet is the first judge.
function score(
  scenario: Scenario | null,
  // The first panel is the first three judge calls of the stage.
  panel: number,
  model: string,
  { index, element }: Judged,
  criterion: string,
) {
  switch (scenario) {
    case "swap":
      return element === "price" && panel === 0 ? 1 : 4;
    case "no_pass":
      return 1;
    case "two_pass":
      return index < 2 ? 4 : 1;
    case "no_cover":
      return element === "price" ? 1 : 4;
    case "low_confidence":
      if (criterion !== "message") return 4;
      return model.startsWith("anthropic")
        ? 5
        : model.startsWith("openai")
          ? 3
          : 4;
    default:
      return 4;
  }
}

// Answers the round's tasks without a model, for the end-to-end tests. The plan ignores the rules on purpose (empty photo ids, no elements), so the code that enforces them runs on every round. Every background is a Bria scene, so each round makes a fake Fal call. The judges' scores come from the scenario.
export function createScriptedAi(
  options: { scenario: Scenario | null } = { scenario: null },
): Ai {
  let judgeCalls = 0;
  return {
    async generate<T>(request: AiRequest<T>) {
      const panel = request.task === "judge" ? Math.floor(judgeCalls++ / 3) : 0;
      return {
        object: request.schema.parse(
          scripted(request, options.scenario, panel),
        ),
        costUsd: null,
      };
    },
  };
}

function scripted(
  request: AiRequest<unknown>,
  scenario: Scenario | null,
  panel: number,
) {
  switch (request.task) {
    case "art_direction":
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
    case "copy":
    case "copy_rewrite":
      return {
        candidates: HEADLINES.map((headline, index) => ({
          index,
          eyebrow: "New season picks",
          headline,
          cta: "Shop now",
        })),
      };
    case "brief_rewrite":
      return {
        rules: [
          { kind: "do", text: "Keep headlines short and calm" },
          { kind: "dont", text: "Fill the background with orange" },
        ],
      };
    case "judge": {
      // The judged creatives are in the prompt's JSON; the fake copy gave candidate i the i-th headline.
      const { creatives: shown } = JSON.parse(
        request.prompt.slice(request.prompt.indexOf("{")),
      ) as { creatives: { headline: string | null; badge: string | null }[] };
      const candidates: Judged[] = shown.map((creative) => ({
        index: HEADLINES.indexOf(creative.headline ?? ""),
        element: creative.badge,
      }));
      const creatives = candidates.map((candidate, place) => ({
        id: place + 1,
        ...Object.fromEntries(
          CRITERIA.map((criterion) => [
            criterion,
            {
              reason: "fake",
              score: score(
                scenario,
                panel,
                request.model,
                candidate,
                criterion,
              ),
            },
          ]),
        ),
      }));
      const total = (id: number) =>
        CRITERIA.reduce(
          (sum, criterion) =>
            sum +
            score(
              scenario,
              panel,
              request.model,
              candidates[id - 1] as Judged,
              criterion,
            ),
          0,
        );
      return {
        creatives,
        ranking: creatives
          .map(({ id }) => id)
          .sort((a, b) => total(b) - total(a) || a - b),
      };
    }
    default:
      throw new Error(`fake ai: no script for task ${request.task}`);
  }
}
