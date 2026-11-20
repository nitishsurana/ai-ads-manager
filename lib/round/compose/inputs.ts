import type { BadgeSpec, LayoutInput } from "@/lib/render";
import { parseColour } from "@/lib/intake";
import type { Rgb } from "@/lib/render/colour";
import type { RoundInputs } from "../inputs";
import type { Candidate } from "../types";

const parsed = (value: string | null | undefined): Rgb | null =>
  value ? parseColour(value) : null;

export const parseColours = (values: (string | null | undefined)[]) =>
  values.map(parsed).filter((colour) => colour !== null);

// What the badge shows, taken from the confirmed values and facts only; null when the candidate has no element or its data is gone.
export function badgeSpec(
  candidate: Candidate,
  inputs: RoundInputs,
): BadgeSpec | null {
  const { values } = inputs;
  switch (candidate.supportingElement) {
    case "price":
      return values.price
        ? {
            kind: "price",
            price: values.price,
            was: values.wasPrice,
            currency: values.currency,
          }
        : null;
    case "rating":
      return values.rating ? { kind: "rating", ...values.rating } : null;
    case "offer": {
      const fact = inputs.facts.find((f) => f.id === candidate.offerFactId);
      return fact ? { kind: "offer", text: fact.text } : null;
    }
    default:
      return null;
  }
}

export function brandColours(inputs: RoundInputs): {
  brandColours: Rgb[];
  brandInks: Rgb[];
} {
  const { palette } = inputs.brandKit;
  return {
    brandColours: [
      ...parseColours([
        palette.primary,
        palette.secondary,
        palette.themeColour,
        palette.background,
        palette.text,
      ]),
      ...parseColours(inputs.logo?.colours ?? []),
    ],
    brandInks: parseColours([palette.text, palette.background]),
  };
}

export const brandInk = (inputs: RoundInputs) =>
  parsed(inputs.brandKit.palette.primary);

// The brand's own colours for a "brand" button: the palette's primary and secondary, whatever else the CTA must stay away from.
export const brandButton = (inputs: RoundInputs) => ({
  primary: parsed(inputs.brandKit.palette.primary),
  secondary: parsed(inputs.brandKit.palette.secondary),
});

export type { LayoutInput };

// The text a wordmark logo draws: the logo's own, else the brand name.
export const wordmarkName = (inputs: RoundInputs) =>
  inputs.logo?.textRead ?? inputs.logo?.text ?? inputs.values.brandName;
