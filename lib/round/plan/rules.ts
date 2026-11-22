import type { FrozenPhoto, RoundInputs } from "../inputs";
import { ANGLES, type Angle, type SupportingElement } from "../types";

export const CANDIDATES = 6;
export const MIN_PER_ELEMENT = 2;
export const OFFER_BADGE_MAX_CHARS = 40;

// An angle that is about one element shows that element.
export const ANGLE_ELEMENT: Partial<Record<Angle, SupportingElement>> = {
  social_proof: "rating",
  price: "price",
  offer: "offer",
};

const TIERS = ["clean", "clean_low_res", "added_text"] as const;

export function badgeOffers({ facts }: Pick<RoundInputs, "facts">) {
  return facts.filter(
    (fact) =>
      fact.kind === "offer" && fact.text.length <= OFFER_BADGE_MAX_CHARS,
  );
}

export function elementsOn(inputs: RoundInputs): SupportingElement[] {
  return [
    ...(inputs.values.price !== null ? (["price"] as const) : []),
    ...(inputs.values.rating !== null ? (["rating"] as const) : []),
    ...(badgeOffers(inputs).length > 0 ? (["offer"] as const) : []),
  ];
}

export function usableAngles(inputs: RoundInputs): Angle[] {
  return ANGLES.filter((angle) => {
    if (angle === "social_proof") return inputs.values.rating !== null;
    if (angle === "price") return inputs.values.price !== null;
    if (angle === "offer") return inputs.facts.some((f) => f.kind === "offer");
    return true;
  });
}

// A gift set on a plain backdrop that is not one colour (a studio gradient): no mask keeps the box and card.
export const isWholeSet = (photo: FrozenPhoto) =>
  photo.giftSet &&
  photo.backdropUniform === false &&
  photo.background === "plain" &&
  !photo.person;

// A person or a gift set on a non-uniform backdrop has no clean cut-out, so it is the last resort.
export const isUncuttable = (photo: FrozenPhoto) =>
  photo.person || isWholeSet(photo);

// Uncuttable photos are used only when no other photo is selected. A tier is used only when the tier above has no selected photo; when every photo has added text, every creative uses the featured one (the first remaining).
export function allowedPhotos(all: FrozenPhoto[]): FrozenPhoto[] {
  const cuttable = all.filter((photo) => !isUncuttable(photo));
  const photos = cuttable.length > 0 ? cuttable : all;
  const tier = TIERS.find((name) => photos.some((p) => p.tier === name));
  const ofTier = photos.filter((photo) => photo.tier === tier);
  if (tier !== "added_text") return ofTier;
  const featured = ofTier.reduce<FrozenPhoto | null>(
    (first, photo) =>
      first === null || photo.position < first.position ? photo : first,
    null,
  );
  return featured ? [featured] : [];
}
