import { createGateway, generateText, Output } from "ai";
import { gatewayCostUsd } from "./cost";
import type { Ai } from "./types";

const TIMEOUT_MS = 60_000;
// A transient error is also covered by the photo stage's escalation and skip rules.
const MAX_RETRIES = 1;

let gateway: ReturnType<typeof createGateway> | undefined;

export function gatewayClient() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("ai: AI_GATEWAY_API_KEY is not set");
  gateway ??= createGateway({ apiKey });
  return gateway;
}

export function createRealAi(): Ai {
  return {
    async generate(request) {
      const result = await generateText({
        model: gatewayClient()(request.model),
        system: request.system,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: request.prompt },
              ...(request.images ?? []).map((data) => ({
                type: "file" as const,
                mediaType: "image/jpeg",
                data,
              })),
            ],
          },
        ],
        output: Output.object({ schema: request.schema }),
        maxRetries: MAX_RETRIES,
        abortSignal: AbortSignal.timeout(request.timeoutMs ?? TIMEOUT_MS),
      });

      return {
        object: result.output,
        costUsd: gatewayCostUsd(result.providerMetadata),
      };
    },
  };
}
