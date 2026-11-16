import { createGateway, generateText, Output } from "ai";
import { z } from "zod";
import type { Ai } from "./types";

const TIMEOUT_MS = 60_000;
// A transient error is also covered by the photo stage's escalation and skip rules.
const MAX_RETRIES = 1;

const metadataSchema = z.object({
  gateway: z.object({ cost: z.coerce.number().optional() }).optional(),
});

let gateway: ReturnType<typeof createGateway> | undefined;

function gatewayClient() {
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
              ...(request.image
                ? [
                    {
                      type: "file" as const,
                      mediaType: "image/jpeg",
                      data: request.image,
                    },
                  ]
                : []),
            ],
          },
        ],
        output: Output.object({ schema: request.schema }),
        maxRetries: MAX_RETRIES,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const metadata = metadataSchema.safeParse(result.providerMetadata);
      return {
        object: result.output,
        costUsd: metadata.success
          ? (metadata.data.gateway?.cost ?? null)
          : null,
      };
    },
  };
}
