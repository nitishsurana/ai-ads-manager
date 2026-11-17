import { z } from "zod";
import type { RoundInputs } from "./inputs";

const faultSchema = z.enum(["slow", "no_pass", "fail"]);
export type Fault = z.infer<typeof faultSchema>;

// Fault injection for the end-to-end tests, only under PROVIDERS=fake (never allowed in production): a campaign occasion of "fake:slow" or "fake:fail" makes the scripted fake ai overrun or throw, and "fake:no_pass" makes the stub checks select nothing.
export function faultFor(inputs: RoundInputs): Fault | null {
  if (process.env.PROVIDERS !== "fake") return null;
  const match = /^fake:(.+)$/.exec(inputs.campaign.occasion ?? "");
  return faultSchema.safeParse(match?.[1]).data ?? null;
}
