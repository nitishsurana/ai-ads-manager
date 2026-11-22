import type {
  BrandKit,
  Logo,
  OrderFlow,
  PageVariant,
  PhotoTier,
  PhotoWarning,
} from "@/lib/intake";

export type ConfirmPhoto = {
  position: number;
  thumbPath: string;
  tier: PhotoTier;
  warnings: PhotoWarning[];
  selected: boolean;
};

// The variant's own price and, when its compare-at is higher, its strike-through.
export type ConfirmVariant = PageVariant & {
  price: string | null;
  wasPrice: string | null;
};

export type ConfirmState = {
  notPurchasable: boolean;
  // Photos that couldn't be read; null when none were skipped.
  photosSkipped: { skipped: number; total: number } | null;
  orderFlow: OrderFlow;
  // null until the tester answers the not-purchasable flag.
  continuePastFlag: boolean | null;
  // The tester says the product can be bought after all. A stopgap for stores whose add-to-cart sits where the purchase check doesn't look (Glossier keeps it in a sticky bar outside the product section).
  markedAvailable: boolean;
  needsVariantChoice: boolean;
  variants: ConfirmVariant[];
  variantId: number | null;
  // A variant that can't be bought, or whose stock couldn't be read, must be confirmed once the tester has picked it.
  variantConfirmed: boolean;
  // Photos that survived the cut-out check, all preselected.
  photos: ConfirmPhoto[];
  // True once the tester has typed, switched or hidden a price: picking a variant then leaves the pricing alone.
  pricingEdited: boolean;
  showPrice: boolean;
  price: string | null;
  showWasPrice: boolean;
  wasPrice: string | null;
  currency: string;
  currencies: string[];
  rating: { value: number; count: number } | null;
  showRating: boolean;
  storeName: string | null;
  // `needed` shows the prompt; it starts empty and `answered` turns on once the tester has submitted it, blank or not.
  brandName: { needed: boolean; answered: boolean; value: string };
  logo: Logo | null;
  brandKit: BrandKit;
};
