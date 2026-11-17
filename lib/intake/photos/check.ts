import { SnapshotError } from "@/lib/providers/snapshot";
import { MODEL_COPY_VERSION } from "./copies";
import { logSwallowed } from "./log";
import { photoChecksSchema } from "./types";
import type { CostEntry, PhotoChecks, PhotosDeps } from "./types";
import { PHOTO_CHECK_PROMPT, PHOTO_CHECK_SYSTEM } from "./prompts";

export const PRIMARY_MODEL = "anthropic/claude-haiku-5.5";
export const ESCALATION_MODEL = "anthropic/claude-sonnet-5.5";

// A low-confidence answer, or any primary-model failure (refusal, schema miss, timeout), goes to the larger model. A photo the primary model says has added text gets the larger model's answer too, and that answer decides, because the added-text judgement drives the drop rules and the primary model flips on borderline photos. If that second call fails, the primary answer stands.
// Both failing gives checks: null, with the cost of whatever did answer.
export async function checkPhoto(
  input: { label: string; sha256: string; image: Buffer },
  deps: Pick<PhotosDeps, "ai">,
): Promise<{ checks: PhotoChecks | null; costs: CostEntry[] }> {
  const costs: CostEntry[] = [];

  async function ask(task: string, model: string): Promise<PhotoChecks | null> {
    try {
      const { object, costUsd } = await deps.ai.generate({
        task,
        inputSha256: input.sha256,
        inputVersion: MODEL_COPY_VERSION,
        model,
        system: PHOTO_CHECK_SYSTEM,
        prompt: PHOTO_CHECK_PROMPT,
        images: [input.image],
        schema: photoChecksSchema,
      });
      costs.push({ provider: "ai", model, usd: costUsd });
      return { ...object, model };
    } catch (error) {
      if (error instanceof SnapshotError) throw error;
      logSwallowed(input.label, task, error);
      return null;
    }
  }

  const first = await ask("photo_check", PRIMARY_MODEL);
  if (first && first.confidence !== "low") {
    if (!first.added_text) return { checks: first, costs };
    const decided = await ask("photo_check_text", ESCALATION_MODEL);
    return { checks: decided ?? first, costs };
  }
  return {
    checks: await ask("photo_check_escalated", ESCALATION_MODEL),
    costs,
  };
}
