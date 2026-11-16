export { createIntakeDeps } from "./deps";
export { runIntake, runIntakeUntilBrand } from "./pipeline";
export { BrandStageError } from "./brand";
export type {
  BrandKit,
  BrandResult,
  Logo,
  LogoColourClass,
  LogoSource,
  Palette,
} from "./brand";
export type { PageFacts, PageRating, PageVariant, PurchaseState } from "./page";
export type {
  CostEntry,
  DropReason,
  Photo,
  PhotoChecks,
  PhotosResult,
  PhotoTier,
  PhotoWarning,
} from "./photos";
export type { ShopifyProduct } from "./product";
export type {
  IntakeDeps,
  IntakeFailure,
  IntakeOutcome,
  IntakeProgress,
  IntakeResult,
  IntakeWarning,
  Market,
  UntilBrandOutcome,
} from "./types";
