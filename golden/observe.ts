import { isDeepStrictEqual } from "node:util";
import {
  type BrandResult,
  type IntakeOutcome,
  type UntilBrandOutcome,
} from "@/lib/intake";
import { ESCALATION_MODEL } from "@/lib/intake/photos";
import { messages } from "@/lib/messages";

export type Outcome = IntakeOutcome | UntilBrandOutcome;

export function observe(outcome: Outcome): Record<string, unknown> {
  if (!outcome.ok) {
    return { message: `Failure: ${messages[outcome.code]}` };
  }
  if ("existingWorkspaceId" in outcome) {
    return { message: null, existingWorkspaceId: outcome.existingWorkspaceId };
  }
  const { productKey, finalUrl, market, page, photos, warnings } =
    outcome.result;
  const brand = "brand" in outcome.result ? outcome.result.brand : undefined;
  const dropped = photos.photos.filter((photo) => photo.dropped);
  const shown = photos.photos.filter((photo) => photo.selected);
  const warns = (code: string) =>
    shown.some((photo) => photo.warnings.includes(code as never));
  return {
    message: null,
    productKey,
    finalUrl,
    market,
    price: page.price,
    wasPrice: page.wasPrice,
    currency: page.currency,
    purchase: page.purchase,
    orderFlow: page.orderFlow,
    needsVariantChoice: page.needsVariantChoice,
    buyableVariants: page.variants.filter((v) => v.availability === "buyable")
      .length,
    rating: page.rating,
    warnings: warnings.map((code) => `Warning: ${messages[code]}`),
    uniquePhotos: photos.photos.length,
    shownPhotos: shown.length,
    droppedPositions: dropped.map((photo) => photo.position),
    dropReasons: Object.fromEntries(
      dropped.map((photo) => [photo.position, photo.dropReason]),
    ),
    duplicatePositions: photos.duplicates.map((d) => d.position),
    skippedPositions: photos.skipped.map((s) => s.position),
    escalatedPositions: photos.photos
      .filter((photo) => photo.checks.model === ESCALATION_MODEL)
      .map((photo) => photo.position),
    giftSetPositions: shown
      .filter((photo) => photo.checks.gift_set)
      .map((photo) => photo.position),
    nonUniformBackdropPositions: shown
      .filter((photo) => photo.checks.backdrop_uniform === false)
      .map((photo) => photo.position),
    lowResWarning: warns("low_resolution"),
    textWarning: warns("photo_text"),
    transparentWarning: warns("transparent"),
    ...observeBrand(brand),
  };
}

function observeBrand(brand: BrandResult | undefined) {
  if (!brand) return {};
  const { logo, brandKit, brandKitScraped } = brand;
  return {
    brandPages: brand.pages,
    logoSource: logo?.source ?? null,
    logoColourClass: logo?.colourClass ?? null,
    logoTransparent: logo?.transparent ?? null,
    logoColours: logo?.colours ?? [],
    logoBadge: logo?.badge ?? false,
    logoSize: logo?.width && logo.height ? [logo.width, logo.height] : null,
    headerBackground: logo?.headerBackground ?? null,
    storeName: brand.storeName,
    needsBrandName: brand.needsBrandName,
    headingFont: brandKit.fonts.heading.family,
    bodyFont: brandKit.fonts.body.family,
    palettePrimary: brandKit.palette.primary,
    paletteSecondary: brandKit.palette.secondary,
    paletteBackground: brandKit.palette.background,
    kitReady:
      brandKit !== brandKitScraped &&
      isDeepStrictEqual(brandKit, brandKitScraped) &&
      brandKit.tone.length === 3 &&
      brandKit.valuePropositions.length === 3,
  };
}
