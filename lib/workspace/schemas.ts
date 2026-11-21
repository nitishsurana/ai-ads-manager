import { z } from "zod";
import type { BrandKit, Logo, PageFacts } from "@/lib/intake";

// What persistSuccess wrote to the workspace's JSON columns, read back with the fields the confirm screen uses.
const colour = z.string().nullable();
const typeface = z.object({
  declared: z.string().nullable(),
  family: z.string(),
  exact: z.boolean(),
});

export const brandKitSchema = z.object({
  palette: z.object({
    primary: colour,
    secondary: colour,
    background: colour,
    text: colour,
    themeColour: colour,
  }),
  fonts: z.object({ heading: typeface, body: typeface }),
  tone: z.array(z.string()),
  audience: z.string(),
  valuePropositions: z.array(z.string()),
  proofPoints: z.array(z.string()),
}) satisfies z.ZodType<BrandKit>;

export const logoSchema = z.object({
  source: z.enum([
    "header",
    "storefront",
    "structured_data",
    "og_image",
    "wordmark",
  ]),
  pngPath: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  sourceUrl: z.string().nullable(),
  text: z.string().nullable(),
  textRead: z.string().nullable().default(null),
  colourClass: z
    .enum(["one_colour", "current_colour", "multi_colour"])
    .nullable(),
  colours: z.array(z.string()),
  transparent: z.boolean(),
  headerBackground: z.string().nullable(),
  iconOnly: z.boolean(),
  storeBrand: z.boolean(),
  badge: z.boolean().default(false),
}) satisfies z.ZodType<Logo>;

const pageFactsSchema = z.object({
  price: z.string().nullable(),
  priceAmount: z.number().nullable(),
  wasPrice: z.string().nullable(),
  currency: z.string(),
  purchase: z.enum([
    "purchasable",
    "not_purchasable",
    "store_only",
    "not_sold_online",
    "pre_order",
  ]),
  orderFlow: z.enum(["direct", "personalize"]).default("direct"),
  needsVariantChoice: z.boolean(),
  variants: z.array(
    z.object({
      id: z.number(),
      availability: z.enum(["buyable", "unavailable", "unknown"]),
    }),
  ),
  rating: z
    .object({ value: z.number(), count: z.number(), show: z.boolean() })
    .nullable(),
}) satisfies z.ZodType<PageFacts>;

export const productJsonSchema = z.object({
  shopify: z.object({
    title: z.string(),
    variants: z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        price: z.string(),
        compareAtPrice: z.string().nullable(),
      }),
    ),
  }),
  page: pageFactsSchema,
  storeName: z.string().nullable(),
  needsBrandName: z.boolean(),
  warnings: z.array(z.literal("not_purchasable")),
  photosSkipped: z
    .object({ skipped: z.number().int(), total: z.number().int() })
    .nullable()
    .default(null),
});

// The tester's answers that have no column of their own: photo selection lives on the photos, the edited brand kit on brand_kit and the campaign on campaign.
export const storedConfirmSchema = z.object({
  continuePastFlag: z.boolean().nullable(),
  variantId: z.number().nullable(),
  variantConfirmed: z.boolean(),
  pricingEdited: z.boolean(),
  showPrice: z.boolean(),
  price: z.string().nullable(),
  showWasPrice: z.boolean(),
  wasPrice: z.string().nullable(),
  currency: z.string(),
  showRating: z.boolean(),
  brandName: z.object({
    needed: z.boolean(),
    answered: z.boolean(),
    value: z.string(),
  }),
});

export type StoredConfirm = z.infer<typeof storedConfirmSchema>;
