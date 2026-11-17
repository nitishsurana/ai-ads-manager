import { aiSnapshotKey, type Ai } from "@/lib/providers/ai";
import { recordedErrorSchema } from "@/lib/providers/snapshot";

// Calls the real models and keeps every answer (and every failure) under its replay key, with the gateway's reported cost. A request already answered is answered from the log, so asking again (the runner re-checks what was shown) costs nothing.
export function recordingAi(real: Ai, log: Record<string, unknown>) {
  const spend = { usd: 0, calls: 0 };
  const ai: Ai = {
    async generate(request) {
      const key = aiSnapshotKey(request);
      const kept = log[key];
      if (kept !== undefined) {
        const failure = recordedErrorSchema.safeParse(kept);
        if (failure.success) throw new Error(failure.data.error);
        return { object: request.schema.parse(kept), costUsd: null };
      }
      spend.calls++;
      try {
        const result = await real.generate(request);
        log[key] = result.object;
        spend.usd += result.costUsd ?? 0;
        return result;
      } catch (error) {
        log[key] = {
          error: error instanceof Error ? error.message : String(error),
        };
        throw error;
      }
    },
  };
  return { ai, spend };
}
