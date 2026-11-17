import { z } from "zod";
import type { RoundInputs } from "./inputs";

const scenarioSchema = z.enum([
  "slow",
  "fail",
  "l1_fail",
  "no_pass",
  "two_pass",
  "no_cover",
  "swap",
  "low_confidence",
]);
export type Scenario = z.infer<typeof scenarioSchema>;

// Fault injection for the end-to-end tests, only under PROVIDERS=fake (never allowed in production). A campaign occasion of "fake:<scenario>" picks one: slow and fail make the scripted Fal overrun or throw, l1_fail makes its first background carry a frame (a Layer 1 failure that forces regeneration), and the rest set the scripted judges' scores (none passing, two passing, no passing candidate showing the price badge, the same until a covering swap gives the badge to a creative that then passes, the judges 2 points apart on every creative).
export function scenarioFor(inputs: RoundInputs): Scenario | null {
  if (process.env.PROVIDERS !== "fake") return null;
  const match = /^fake:(.+)$/.exec(inputs.campaign.occasion ?? "");
  return scenarioSchema.safeParse(match?.[1]).data ?? null;
}
