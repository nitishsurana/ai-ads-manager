import type {
  BrandResult,
  IntakeResult,
  PageFacts,
  Photo,
  ShopifyProduct,
} from "@/lib/intake";
import { formatAmount } from "@/lib/money";
import { currencyChoices } from "./currency";
import type { ConfirmState } from "./types";

// The part of an intake result the screen reads, so a workspace can rebuild it from its stored rows.
export type ConfirmSource = {
  product: {
    variants: Pick<
      ShopifyProduct["variants"][number],
      "id" | "price" | "compareAtPrice"
    >[];
  };
  page: PageFacts;
  photos: {
    photos: Pick<
      Photo,
      "position" | "thumbPath" | "tier" | "warnings" | "dropped"
    >[];
  };
  brand: Pick<
    BrandResult,
    "storeName" | "needsBrandName" | "logo" | "brandKit"
  >;
  warnings: IntakeResult["warnings"];
  photosSkipped: IntakeResult["photosSkipped"];
};

export function initialConfirm(result: ConfirmSource): ConfirmState {
  const { page, photos, brand, product, warnings, photosSkipped } = result;
  const variantsById = new Map(product.variants.map((v) => [v.id, v]));
  return {
    notPurchasable: warnings.includes("not_purchasable"),
    photosSkipped,
    orderFlow: page.orderFlow,
    continuePastFlag: null,
    markedAvailable: false,
    needsVariantChoice: page.needsVariantChoice,
    variants: page.variants.map((variant) => {
      const own = variantsById.get(variant.id);
      const price = own ? Number(own.price) : null;
      const compareAt = own?.compareAtPrice ? Number(own.compareAtPrice) : null;
      return {
        ...variant,
        price: price === null ? null : formatAmount(price, page.currency),
        wasPrice:
          price !== null && compareAt !== null && compareAt > price
            ? formatAmount(compareAt, page.currency)
            : null,
      };
    }),
    variantId: null,
    variantConfirmed: false,
    photos: photos.photos
      .filter((photo) => !photo.dropped)
      .map((photo) => ({
        position: photo.position,
        thumbPath: photo.thumbPath,
        tier: photo.tier,
        warnings: photo.warnings,
        selected: true,
      })),
    pricingEdited: false,
    showPrice: true,
    price: page.price,
    showWasPrice: page.wasPrice !== null,
    wasPrice: page.wasPrice,
    currency: page.currency,
    currencies: currencyChoices(page.currency),
    rating: page.rating && {
      value: page.rating.value,
      count: page.rating.count,
    },
    showRating: page.rating?.show ?? false,
    storeName: brand.storeName,
    brandName: { needed: brand.needsBrandName, answered: false, value: "" },
    logo: brand.logo,
    brandKit: structuredClone(brand.brandKit),
  };
}
