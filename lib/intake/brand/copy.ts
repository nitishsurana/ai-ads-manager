import { z } from "zod";
import type { Ai } from "@/lib/providers/ai";
import { sha256 } from "@/lib/providers/snapshot";
import type { CostEntry } from "../photos";
import { pageText } from "./text";

export const COPY_MODEL = "anthropic/claude-opus-5.5";

const PRODUCT_CHARS = 4_000;
const SITE_CHARS = 6_000;

const copySchema = z.object({
  tone: z.array(z.string()),
  audience: z.string(),
  value_propositions: z.array(z.string()),
  proof_points: z.array(z.string()),
});

const SYSTEM = `You write a brand profile for an ad tool from a store's own web pages. Use only what the text says.
- tone: three adjectives for how the brand sounds.
- audience: one or two sentences on who the brand is for.
- value_propositions: three short statements of what the brand offers shoppers.
- proof_points: facts the text states that back the brand up (years in business, awards, press, review counts, guarantees, certifications). Leave it empty if the text states none.
Never invent a claim, number, discount, superlative or health claim. If the text says little, stay general rather than guess.`;

export type BrandCopy = {
  tone: string[];
  audience: string;
  valuePropositions: string[];
  proofPoints: string[];
};

const clean = (items: string[], max: number) =>
  items
    .map((item) => item.trim())
    .filter((item) => item !== "")
    .slice(0, max);

export async function writeBrandCopy(
  input: {
    storeName: string | null;
    pages: { product: string; homepage: string; about: string | null };
  },
  deps: { ai: Ai },
  costs: CostEntry[],
): Promise<BrandCopy> {
  const { product, homepage, about } = input.pages;
  const prompt = [
    `Store: ${input.storeName ?? "unknown"}`,
    `## Product page\n${pageText(product, PRODUCT_CHARS)}`,
    `## Homepage\n${pageText(homepage, SITE_CHARS)}`,
    ...(about ? [`## About page\n${pageText(about, SITE_CHARS)}`] : []),
  ].join("\n\n");

  const { object, costUsd } = await deps.ai.generate({
    task: "brand_copy",
    inputSha256: sha256(Buffer.from(prompt)),
    model: COPY_MODEL,
    system: SYSTEM,
    prompt,
    schema: copySchema,
  });
  costs.push({ provider: "ai", model: COPY_MODEL, usd: costUsd });
  return {
    tone: clean(object.tone, 3),
    audience: object.audience.trim(),
    valuePropositions: clean(object.value_propositions, 3),
    proofPoints: clean(object.proof_points, 5),
  };
}
