import { checkCopy, systemFor } from "@/lib/round/copy";
import type { RoundInputs } from "@/lib/round/inputs";
import { same, type Case } from "./cases";
import { BASE_INPUTS } from "./render-cases";

const CTA_FAILURE = {
  part: "cta",
  text: 'the CTA must invite the shopper to personalize the product, such as "Personalize yours"',
};

const CTAS: [RoundInputs["orderFlow"], cta: string, failures: unknown[]][] = [
  ["personalize", "Personalize yours", []],
  ["personalize", "Start personalizing", []],
  ["personalize", "Make it yours", []],
  ["personalize", "Customize it", []],
  ["personalize", "Shop now", [CTA_FAILURE]],
  ["personalize", "Buy today", [CTA_FAILURE]],
  ["direct", "Shop now", []],
];

export const COPY_CASES: Case[] = [
  {
    name: "copy check: a personalized product's CTA must invite personalizing",
    run: () =>
      same(
        CTAS.map(([orderFlow, cta]) =>
          checkCopy(
            { eyebrow: null, headline: "Slow mornings", cta },
            { ...BASE_INPUTS, orderFlow },
          ),
        ),
        CTAS.map(([, , failures]) => failures),
      ),
  },
  {
    name: "copy prompt: only the direct system suggests Shop now",
    run: () =>
      same(
        [systemFor("direct"), systemFor("personalize")].map((system) =>
          system.includes("Shop now"),
        ),
        [true, false],
      ),
  },
];
