import { z } from "zod";
import type { RoundInputs } from "./inputs";

const faultSchema = z.enum(["slow", "no_pass", "fail"]);
export type Fault = z.infer<typeof faultSchema>;

// Fault injection for the end-to-end tests, only under PROVIDERS=fake (never allowed in production): a campaign occasion of "fake:slow", "fake:no_pass" or "fake:fail" makes the stub stages overrun, select nothing, or throw.
export function faultFor(inputs: RoundInputs): Fault | null {
  if (process.env.PROVIDERS !== "fake") return null;
  const match = /^fake:(.+)$/.exec(inputs.campaign.occasion ?? "");
  return faultSchema.safeParse(match?.[1]).data ?? null;
}
