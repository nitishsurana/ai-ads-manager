import { z } from "zod";
import { layoutSchema } from "@/lib/render";
import type { RoundCreative } from "@/lib/db/queries";
import { ANGLES, type Background, type Copy } from "./types";

const copyJson = z.object({
  eyebrow: z.string().nullable(),
  headline: z.string(),
  cta: z.string(),
}) satisfies z.ZodType<Copy>;

const backgroundJson = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("bria"),
    prompt: z.string(),
    reason: z.string(),
  }),
  z.object({ method: z.enum(["solid", "tonal"]), reason: z.string() }),
  z.object({ method: z.literal("photo") }),
]) satisfies z.ZodType<Background>;

const textPair = z.object({ headline: z.string(), cta: z.string() });

// One saved inline edit: what the headline and CTA were and what they became.
export const editSchema = z.object({
  at: z.string(),
  from: textPair,
  to: textPair,
});
export type Edit = z.infer<typeof editSchema>;

// A stored creative as the code that reads or writes it needs it. A malformed copy, layout or edit log is a programming error, so it throws.
export function parseCreative(row: RoundCreative) {
  return {
    ...row,
    angle: z.enum(ANGLES).parse(row.angle),
    background: backgroundJson.parse(row.background),
    copy: copyJson.parse(row.copy),
    layout: layoutSchema.parse(row.layout),
    edits: z.array(editSchema).parse(row.edits),
  };
}
