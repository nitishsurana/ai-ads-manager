export type PurchaseState =
  | "purchasable"
  | "not_purchasable"
  | "store_only"
  | "not_sold_online"
  | "pre_order";

export type VariantAvailability = "buyable" | "unavailable" | "unknown";

export type PageVariant = { id: number; availability: VariantAvailability };

export type PageRating = { value: number; count: number; show: boolean };

export type PageFacts = {
  price: string | null;
  priceAmount: number | null;
  wasPrice: string | null;
  currency: string;
  purchase: PurchaseState;
  needsVariantChoice: boolean;
  variants: PageVariant[];
  rating: PageRating | null;
};
