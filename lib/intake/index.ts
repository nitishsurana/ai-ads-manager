export { createIntakeDeps } from "./deps";
export { runIntake, runIntakeBrand, runIntakeUntilBrand } from "./pipeline";
export {
  BrandStageError,
  contrast,
  fromHex,
  parseColour,
  toHex,
  type Rgb,
} from "./brand";
export {
  backdropMask,
  chooseMask,
  countMainShapes,
  makeCutout,
  mapLimit,
  MASK_MODEL,
  maskStats,
  unionMask,
  PhotosStageError,
  photoWarnings,
} from "./photos";
export type {
  BrandKit,
  BrandResult,
  Logo,
  LogoColourClass,
  LogoSource,
  Palette,
} from "./brand";
export type {
  OrderFlow,
  PageFacts,
  PageRating,
  PageVariant,
  PurchaseState,
} from "./page";
export type {
  CostEntry,
  DropReason,
  MaskChoice,
  MaskFal,
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
