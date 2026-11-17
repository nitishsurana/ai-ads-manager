import type { IntakeResult } from "@/lib/intake";
import { formatAmount } from "@/lib/money";
import { currencyChoices } from "./currency";
import type { ConfirmState } from "./types";

export function initialConfirm(result: IntakeResult): ConfirmState {
  const { page, photos, brand, product, warnings } = result;
  const variantsById = new Map(product.variants.map((v) => [v.id, v]));
  return {
    notPurchasable: warnings.includes("not_purchasable"),
    continuePastFlag: null,
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
