import type { BriefSettings } from "@/lib/brief/schema";
import type { FrozenPhoto, RoundInputs } from "../inputs";
import type { Angle, Background, Candidate, SupportingElement } from "../types";
import { SCENE_PROMPT_MAX_CHARS } from "./prompt";
import {
  allowedPhotos,
  ANGLE_ELEMENT,
  badgeOffers,
  CANDIDATES,
  elementsOn,
  isWholeSet,
  MIN_PER_ELEMENT,
  usableAngles,
  usesWholePhoto,
} from "./rules";
import type { RawPlan } from "./schema";

const REASON_MAX_CHARS = 200;

// The model's answer is unusable, not just imperfect.
export class PlanRejected extends Error {}

type Proposed = RawPlan["candidates"][number];

// Each usable angle appears once; the spare slots go to angles not yet approved first.
function angleCaps(usable: Angle[], approved: string[]) {
  const ordered = [
    ...usable.filter((angle) => !approved.includes(angle)),
    ...usable.filter((angle) => approved.includes(angle)),
  ];
  const caps = new Map(usable.map((angle) => [angle, 1]));
  for (let spare = 0; spare < CANDIDATES - usable.length; spare++) {
    const angle = ordered[spare % ordered.length];
    if (angle) caps.set(angle, (caps.get(angle) ?? 0) + 1);
  }
  return { caps, ordered };
}

function fixAngles(
  proposed: Proposed[],
  inputs: RoundInputs,
  approved: string[],
) {
  const usable = usableAngles(inputs);
  const { caps, ordered } = angleCaps(usable, approved);
  const used = new Map<Angle, number>();
  const kept = proposed.map(({ angle }) => {
    if ((used.get(angle) ?? 0) >= (caps.get(angle) ?? 0)) return null;
    used.set(angle, (used.get(angle) ?? 0) + 1);
    return angle;
  });
  return kept.map((angle) => {
    if (angle) return angle;
    const missing = ordered.find(
      (name) => (used.get(name) ?? 0) < (caps.get(name) ?? 0),
    );
    if (!missing) throw new PlanRejected("no angle left to assign");
    used.set(missing, (used.get(missing) ?? 0) + 1);
    return missing;
  });
}

// Elements short of their minimum take over free candidates that show nothing or have more than their share. Returns the elements that could not be covered.
function coverElements(
  angles: Angle[],
  elements: (SupportingElement | null)[],
  on: SupportingElement[],
) {
  const count = (element: SupportingElement) =>
    elements.filter((shown) => shown === element).length;
  const short: SupportingElement[] = [];
  for (const element of on) {
    while (count(element) < MIN_PER_ELEMENT) {
      const index = angles.findIndex((angle, i) => {
        const shown = elements[i] ?? null;
        return (
          !ANGLE_ELEMENT[angle] &&
          (shown === null || count(shown) > MIN_PER_ELEMENT)
        );
      });
      if (index === -1) {
        short.push(element);
        break;
      }
      elements[index] = element;
    }
  }
  return short;
}

// Pinned angles carry their own element; the others keep the model's choice when it is turned on.
function fixElements(
  angles: Angle[],
  proposed: Proposed[],
  on: SupportingElement[],
) {
  const elements = angles.map((angle, index): SupportingElement | null => {
    const pinned = ANGLE_ELEMENT[angle];
    const wanted = pinned ?? proposed[index]?.element;
    return on.find((element) => element === wanted) ?? null;
  });
  const short = coverElements(angles, elements, on);
  if (short.length > 0) throw new PlanRejected(`cannot cover ${short[0]}`);
  return elements;
}

// The badge is drawn by code, so after copy drops candidates the survivors can take over elements. Returns what is still short, for the selection step to deal with.
export function rebalanceElements(survivors: Candidate[], inputs: RoundInputs) {
  const elements = survivors.map((c) => c.supportingElement);
  const short = coverElements(
    survivors.map((c) => c.angle),
    elements,
    elementsOn(inputs),
  );
  const offer = badgeOffers(inputs)[0];
  return {
    short,
    candidates: survivors.map((candidate, i): Candidate => {
      const element = elements[i] ?? null;
      if (element === candidate.supportingElement) return candidate;
      return {
        ...candidate,
        supportingElement: element,
        offerFactId: element === "offer" ? (offer?.id ?? null) : null,
      };
    }),
  };
}

function cutAtWord(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).trimEnd();
}

// Used when the tester wants scenes and the model chose none.
const DEFAULT_SCENES = [
  "A sunlit light-wood table beside a window, soft morning light, warm neutral colours, calm and uncluttered.",
  "A smooth pale stone surface in soft diffused daylight with a gentle shadow, cool neutral tones, minimal and uncluttered.",
  "A matte warm-beige studio backdrop with a soft glow of light and a gently curved surface, calm and uncluttered.",
];

// A background style of "plain" or "scene" overrides the model's choice; `repaired` says when it did.
function background(
  candidate: Proposed | undefined,
  index: number,
  photo: FrozenPhoto,
  settings: BriefSettings,
): { background: Background; repaired: boolean } {
  if (usesWholePhoto(photo, settings)) {
    return {
      background: {
        method: "photo",
        placement: 2,
        ...(isWholeSet(photo) && { whole: true as const }),
      },
      repaired: false,
    };
  }
  const marks = {
    ...(settings.productSize === "smaller" && { size: "smaller" as const }),
    cutout: 1 as const,
  };
  const reason = (candidate?.background.reason ?? "")
    .trim()
    .slice(0, REASON_MAX_CHARS);
  const prompt = candidate?.background.scenePrompt?.trim() ?? "";
  const scene = candidate?.background.method === "bria" && prompt !== "";
  const { backgroundStyle } = settings;
  if (backgroundStyle === "scene" && !scene) {
    return {
      background: {
        method: "bria",
        prompt: cutAtWord(
          prompt || (DEFAULT_SCENES[index % DEFAULT_SCENES.length] ?? ""),
          SCENE_PROMPT_MAX_CHARS,
        ),
        reason,
        ...marks,
      },
      repaired: true,
    };
  }
  if (scene && backgroundStyle !== "plain") {
    return {
      background: {
        method: "bria",
        prompt: cutAtWord(prompt, SCENE_PROMPT_MAX_CHARS),
        reason,
        ...marks,
      },
      repaired: false,
    };
  }
  return {
    background: {
      method: candidate?.background.method === "solid" ? "solid" : "tonal",
      reason,
      ...marks,
    },
    repaired: scene,
  };
}

// The model proposes; this enforces the round rules and says what it changed.
export function validatePlan(
  raw: RawPlan,
  inputs: RoundInputs,
  approvedAngles: string[],
  settings: BriefSettings,
) {
  if (raw.candidates.length < CANDIDATES) {
    throw new PlanRejected(`the plan has ${raw.candidates.length} candidates`);
  }
  const proposed = raw.candidates.slice(0, CANDIDATES);
  const photos = allowedPhotos(inputs.photos);
  if (photos.length === 0) throw new PlanRejected("no photo to use");
  const offers = badgeOffers(inputs);

  const angles = fixAngles(proposed, inputs, approvedAngles);
  const elements = fixElements(angles, proposed, elementsOn(inputs));
  const repairs: string[] = [];

  const candidates = proposed.map((candidate, index): Candidate => {
    const angle = angles[index] ?? "benefit";
    const element = elements[index] ?? null;
    const photo =
      photos.find((p) => p.id === candidate.photoId) ??
      photos[index % photos.length];
    if (!photo) throw new PlanRejected("no photo to use");
    const offer =
      element === "offer"
        ? (offers.find((o) => o.id === candidate.offerFactId) ?? offers[0])
        : undefined;
    if (angle !== candidate.angle) repairs.push(`candidate ${index}: angle`);
    if (element !== (candidate.element === "none" ? null : candidate.element)) {
      repairs.push(`candidate ${index}: element`);
    }
    if (photo.id !== candidate.photoId)
      repairs.push(`candidate ${index}: photo`);
    const styled = background(candidate, index, photo, settings);
    if (styled.repaired) repairs.push(`candidate ${index}: background`);
    return {
      index,
      angle,
      photoId: photo.id,
      supportingElement: element,
      offerFactId: offer?.id ?? null,
      background: styled.background,
      copy: null,
      ctaColour: settings.ctaColour,
      backgroundPath: null,
      product: null,
      layout: null,
      previewPath: null,
      judge: null,
    };
  });
  return { candidates, repairs };
}
