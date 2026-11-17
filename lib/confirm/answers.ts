import { z } from "zod";
import { FONT_FAMILIES } from "@/lib/fonts";
import { typedAmount } from "@/lib/money";

const price = z
  .string()
  .refine((text) => typedAmount(text) !== null, "a price above zero");

const toggle = z.discriminatedUnion("show", [
  z.strictObject({ show: z.literal(false) }),
  // `value` is an edit, or the strike-through the tester adds; without it the prefilled value is confirmed.
  z.strictObject({ show: z.literal(true), value: price.optional() }),
]);

const hex = z
  .string()
  .regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i)
  .nullable()
  .optional();

const palette = z.strictObject({
  primary: hex,
  secondary: hex,
  background: hex,
  text: hex,
});

const typeface = z
  .string()
  .refine((family) => FONT_FAMILIES.some((font) => font.family === family));

const line = (max: number) => z.string().trim().min(1).max(max);

// The confirm screen's submit shape; server actions parse it with this schema. Kept out of the barrel so client code that only needs the types doesn't pull in zod.
export const answersSchema = z.strictObject({
  continuePastFlag: z.boolean().optional(),
  select: z.array(z.number().int()).optional(),
  deselect: z.array(z.number().int()).optional(),
  variantId: z.number().int().optional(),
  variantConfirmed: z.boolean().optional(),
  price: toggle.optional(),
  wasPrice: toggle.optional(),
  // Empties the price field; it must then be typed again or hidden.
  clearPrice: z.literal(true).optional(),
  currency: z
    .strictObject({ code: z.string().regex(/^[A-Z]{3}$/), price })
    .optional(),
  showRating: z.boolean().optional(),
  // An empty string is the blank answer.
  brandName: z.string().max(80).optional(),
  brandKit: z
    .strictObject({
      palette: palette.optional(),
      // The heading typeface; the screen offers the same fixed list the brand-font mapping uses.
      typeface: typeface.optional(),
      tone: z.array(line(30)).max(5).optional(),
      audience: z.string().trim().max(300).optional(),
      valuePropositions: z.array(line(120)).max(5).optional(),
      proofPoints: z.array(line(120)).max(8).optional(),
    })
    .optional(),
});

export type Answers = z.infer<typeof answersSchema>;
