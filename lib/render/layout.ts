import { z } from "zod";

const number = z.number();
export const boxSchema = z.object({
  x: number,
  y: number,
  w: number,
  h: number,
});
const hex = z.string().regex(/^#[0-9a-f]{6}$/);
const weight = z.union([z.literal(400), z.literal(700)]);

const fontSchema = z.object({
  family: z.string(),
  weight,
  // True when the brand font lacks a glyph of the text and the fallback draws it.
  fallback: z.boolean(),
});

const textSchema = z.object({
  box: boxSchema,
  font: fontSchema,
  size: number,
  colour: hex,
  lines: z.array(z.string()),
  lineHeight: number,
  tracking: number,
});

const rowSchema = z.object({
  text: z.string(),
  size: number,
  weight,
  strike: z.boolean(),
  star: z.boolean(),
});

export const LOGO_DECISIONS = [
  "as_is",
  "recoloured",
  "calmer_corner",
  "header_panel",
  "wordmark",
] as const;

// What the stored creative is made of. With the background, the logo file and the fonts at the versions named in `fonts`, rendering needs nothing else, so a later edit re-renders from this.
export const layoutSchema = z.object({
  version: z.literal(1),
  offerFactId: z.string().nullable(),
  // Every font family drawn, with its Fontsource version, so a later pin bump can't change this creative.
  fonts: z.record(z.string(), z.string()),
  method: z.enum(["bria", "solid", "tonal", "photo"]),
  product: boxSchema.nullable(),
  // A flat wash behind the headline block, only where the background alone doesn't make it readable. Rebuilt on every render, never part of background_path.
  scrim: z
    .object({
      edge: z.enum(["top", "bottom"]),
      box: boxSchema,
      opacity: number,
      colour: hex,
    })
    .nullable(),
  eyebrow: textSchema.nullable(),
  headline: textSchema.extend({ contrast: number }),
  cta: textSchema.extend({
    background: hex,
    radius: number,
    deltaE: number,
    contrast: number,
  }),
  badge: z
    .object({
      kind: z.enum(["price", "rating", "offer"]),
      box: boxSchema,
      font: fontSchema,
      background: hex,
      colour: hex,
      radius: number,
      rows: z.array(rowSchema),
    })
    .nullable(),
  logo: z
    .object({
      kind: z.enum(["image", "wordmark"]),
      box: boxSchema,
      decision: z.enum(LOGO_DECISIONS),
      corner: z.enum(["bottom_right", "bottom_left", "top_right", "top_left"]),
      // The ink an image logo is recoloured to, or the wordmark's colour; null leaves the image as it is.
      ink: hex.nullable(),
      contrast: number,
      panel: z
        .object({ box: boxSchema, colour: hex, radius: number })
        .nullable(),
      wordmark: z
        .object({
          text: z.string(),
          // One line, or two when the name is too wide for the cap on one; layouts stored before wrapping have none.
          lines: z.array(z.string()).optional(),
          font: fontSchema,
          size: number,
        })
        .transform((wordmark) => ({
          ...wordmark,
          lines: wordmark.lines ?? [wordmark.text],
        }))
        .nullable(),
    })
    .nullable(),
  // Elements the layout could not place, with why; logged by the stage.
  dropped: z.array(z.object({ element: z.string(), reason: z.string() })),
});

export type Layout = z.infer<typeof layoutSchema>;
export type TextLayout = z.infer<typeof textSchema>;
export type LogoLayout = NonNullable<Layout["logo"]>;
export type BadgeLayout = NonNullable<Layout["badge"]>;
