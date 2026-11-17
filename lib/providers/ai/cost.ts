import { z } from "zod";

const metadataSchema = z.object({
  gateway: z.object({ cost: z.coerce.number().optional() }).optional(),
});

export function gatewayCostUsd(providerMetadata: unknown) {
  const parsed = metadataSchema.safeParse(providerMetadata);
  return parsed.success ? (parsed.data.gateway?.cost ?? null) : null;
}
