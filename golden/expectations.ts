import { readFileSync } from "node:fs";
import { z } from "zod";

const logoSourceSchema = z
  .enum(["header", "storefront", "structured_data", "og_image", "wordmark"])
  .nullable();

const ratingSchema = z.strictObject({
  value: z.number(),
  count: z.number().int(),
  show: z.boolean(),
});

const expectationSchema = z.strictObject({
  note: z.string().optional(),
  // A model judgement (photo or logo) the model and the CSV disagree on: the expected values stay the CSV's, a mismatch on the judgement fields is reported as TRIAGE while the output equals triageActual, and anything else fails.
  triage: z.string().optional(),
  triageActual: z
    .strictObject({
      shownPhotos: z.number().int().optional(),
      droppedPositions: z.array(z.number().int()).optional(),
      dropReasons: z.record(z.string(), z.string()).optional(),
      logoSource: logoSourceSchema.optional(),
      logoColourClass: z
        .enum(["one_colour", "current_colour", "multi_colour"])
        .nullable()
        .optional(),
    })
    .optional(),
  message: z.string().nullable(),
  existingWorkspaceId: z.string().optional(),
  existingWorkspaces: z.record(z.string(), z.string()).optional(),
  productKey: z.string().optional(),
  finalUrl: z.string().optional(),
  market: z.string().optional(),
  price: z.string().optional(),
  wasPrice: z.string().nullable().optional(),
  currency: z.string().optional(),
  purchase: z.enum(["purchasable", "not_purchasable"]).optional(),
  needsVariantChoice: z.boolean().optional(),
  buyableVariants: z.number().int().optional(),
  rating: ratingSchema.nullable().optional(),
  warnings: z.array(z.string()).optional(),
  uniquePhotos: z.number().int().optional(),
  shownPhotos: z.number().int().optional(),
  droppedPositions: z.array(z.number().int()).optional(),
  dropReasons: z.record(z.string(), z.string()).optional(),
  duplicatePositions: z.array(z.number().int()).optional(),
  // The intake is expected to throw (the tester sees the generic retry message) with this text in the error.
  throws: z.string().optional(),
  skippedPositions: z.array(z.number().int()).optional(),
  escalatedPositions: z.array(z.number().int()).optional(),
  lowResWarning: z.boolean().optional(),
  textWarning: z.boolean().optional(),
  // Brand stage: only rows with a homepage snapshot run it.
  brandPages: z.array(z.enum(["homepage", "about"])).optional(),
  logoSource: logoSourceSchema.optional(),
  logoColourClass: z
    .enum(["one_colour", "current_colour", "multi_colour"])
    .nullable()
    .optional(),
  logoTransparent: z.boolean().optional(),
  logoColours: z.array(z.string()).optional(),
  // Stored PNG width and height.
  logoSize: z.tuple([z.number().int(), z.number().int()]).nullable().optional(),
  headerBackground: z.string().nullable().optional(),
  storeName: z.string().nullable().optional(),
  needsBrandName: z.boolean().optional(),
  headingFont: z.string().optional(),
  paletteBackground: z.string().nullable().optional(),
  // Pixels of the stored logo: its top-left corner and a point a quarter of the way in at mid height (the inside of a ring emblem).
  logoProbe: z
    .strictObject({
      corner: z.enum(["clear", "opaque"]),
      interior: z.enum(["clear", "white", "dark"]),
      // The pixel at the middle, for a mark that must keep its own colour.
      centre: z.enum(["red", "other"]).optional(),
    })
    .optional(),
  // Files stored for the logo (a PNG only; an svg logo is rendered and discarded).
  storedLogoFiles: z.array(z.string()).optional(),
  // The editable kit starts as a separate, equal copy of the scraped one, with three tone words and three value propositions.
  kitReady: z.boolean().optional(),
});

export type Expectation = z.infer<typeof expectationSchema>;

export function loadExpectations() {
  const raw: unknown = JSON.parse(
    readFileSync("golden/expectations.json", "utf8"),
  );
  return z.record(z.string(), expectationSchema).parse(raw);
}
