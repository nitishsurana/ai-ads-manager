export { createIntakeDeps } from "./deps";
export { runIntake, runIntakeBrand, runIntakeUntilBrand } from "./pipeline";
export { BrandStageError } from "./brand";
export { PhotosStageError } from "./photos";
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
  UntilBrandReady,
} from "./types";
