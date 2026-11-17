import type { BriefContent } from "@/lib/brief/schema";
import type { RoundInputs } from "@/lib/round/inputs";
import type { Candidate } from "@/lib/round/types";
import { z } from "zod";

// What a case pins beyond the rules every round must meet. Written by hand from the spec, never from the app's own output.
export const expectSchema = z.strictObject({
  note: z.string().optional(),
  photoIds: z.array(z.string()).optional(),
  // Elements no candidate may show.
  noElements: z.array(z.string()).optional(),
  offerFactId: z.string().optional(),
  angles: z.array(z.string()).optional(),
  // Candidate indexes with no copy after the rewrite.
  dropped: z.array(z.number()).optional(),
  headlines: z.record(z.string(), z.string()).optional(),
  eyebrows: z.record(z.string(), z.string().nullable()).optional(),
  // The badge each surviving candidate shows once copy drops are settled.
  elements: z.record(z.string(), z.string().nullable()).optional(),
});

export type Expect = z.infer<typeof expectSchema>;

const CANDIDATES = 6;
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const count = <T>(items: T[], item: T) =>
  items.filter((other) => other === item).length;

const TIERS = ["clean", "clean_low_res", "added_text"] as const;

// Spec, confirm screen: a tier is used only when the tier above has no selected photo; when all have added text, the featured photo (first by position).
function allowedPhotoIds({ photos }: RoundInputs) {
  const tier = TIERS.find((name) => photos.some((p) => p.tier === name));
  const ofTier = photos
    .filter((photo) => photo.tier === tier)
    .sort((a, b) => a.position - b.position);
  return (tier === "added_text" ? ofTier.slice(0, 1) : ofTier).map((p) => p.id);
}

function usableAngles({ values, facts }: RoundInputs) {
  return [
    "benefit",
    "lifestyle",
    "feature_close_up",
    ...(values.rating ? ["social_proof"] : []),
    ...(values.price ? ["price"] : []),
    ...(facts.some((fact) => fact.kind === "offer") ? ["offer"] : []),
  ];
}

const CLAIM_WORDS =
  /\b(?:off|save|half|bogo|limited|only|warranty|lifetime|guarantee\w*|award\w*|finest|doctor\w*|dermatologist\w*|clinically|recommended|thousands|millions|best|sale|free)\b/g;

const NUMBER = /\d+(?:\.\d+)?/g;
const numbersIn = (text: string) =>
  (text.replace(/(\d),(?=\d{3})/g, "$1").match(NUMBER) ?? []).map(Number);

function planProblems(
  inputs: RoundInputs,
  brief: BriefContent,
  planned: Candidate[],
) {
  const problems: string[] = [];
  if (planned.length !== CANDIDATES) {
    problems.push(`${planned.length} candidates planned, expected 6`);
  }
  const photos = allowedPhotoIds(inputs);
  const usable = usableAngles(inputs);
  const offers = inputs.facts.filter((fact) => fact.kind === "offer");
  const badgeOffers = offers.filter((fact) => fact.text.length <= 40);
  const on = [
    ...(inputs.values.price ? ["price"] : []),
    ...(inputs.values.rating ? ["rating"] : []),
    ...(badgeOffers.length > 0 ? ["offer"] : []),
  ];
  const angles = planned.map((c) => c.angle as string);
  const shown = planned.map((c) => c.supportingElement as string | null);

  for (const candidate of planned) {
    const label = `candidate ${candidate.index}`;
    if (!photos.includes(candidate.photoId)) {
      problems.push(`${label}: photo ${candidate.photoId} is not allowed`);
    }
    if (!usable.includes(candidate.angle)) {
      problems.push(`${label}: angle ${candidate.angle} is not usable`);
    }
    if (
      candidate.supportingElement &&
      !on.includes(candidate.supportingElement)
    ) {
      problems.push(`${label}: element ${candidate.supportingElement} is off`);
    }
    const pinned = { social_proof: "rating", price: "price", offer: "offer" }[
      candidate.angle as string
    ];
    if (
      pinned &&
      on.includes(pinned) &&
      candidate.supportingElement !== pinned
    ) {
      problems.push(`${label}: angle ${candidate.angle} must show ${pinned}`);
    }
    if (candidate.supportingElement === "offer") {
      if (!badgeOffers.some((fact) => fact.id === candidate.offerFactId)) {
        problems.push(`${label}: offer fact is missing or over 40 characters`);
      }
    } else if (candidate.offerFactId !== null) {
      problems.push(`${label}: offerFactId set without an offer badge`);
    }
    const photo = inputs.photos.find((p) => p.id === candidate.photoId);
    const whole = photo && (photo.background === "scene" || photo.person);
    const { background } = candidate;
    if (whole && background.method !== "photo") {
      problems.push(
        `${label}: a whole photo has background ${background.method}`,
      );
    }
    if (!whole && background.method === "photo") {
      problems.push(`${label}: a cut-out photo has no generated background`);
    }
    if (
      background.method === "bria" &&
      (background.prompt.trim() === "" || background.prompt.length > 300)
    ) {
      problems.push(
        `${label}: the scene prompt is empty or over 300 characters`,
      );
    }
  }

  for (const element of on) {
    if (count(shown, element) < 2) {
      problems.push(
        `element ${element} is on but shown ${count(shown, element)} times`,
      );
    }
  }
  const distinct = new Set(angles).size;
  if (distinct !== Math.min(CANDIDATES, usable.length)) {
    problems.push(`${distinct} distinct angles for ${usable.length} usable`);
  }
  const fresh = usable.filter((angle) => !brief.approvedAngles.includes(angle));
  for (const approved of usable.filter((a) =>
    brief.approvedAngles.includes(a),
  )) {
    for (const angle of fresh) {
      if (count(angles, approved) > count(angles, angle)) {
        problems.push(`approved ${approved} repeats while ${angle} is unused`);
      }
    }
  }
  return problems;
}

function copyProblems(inputs: RoundInputs, copied: Candidate[]) {
  const problems: string[] = [];
  const source = [
    inputs.productTitle,
    inputs.values.price,
    inputs.values.wasPrice,
    inputs.values.rating &&
      `${inputs.values.rating.value} ${inputs.values.rating.count}`,
    inputs.values.brandName,
    inputs.brandKit.audience,
    ...inputs.brandKit.valuePropositions,
    ...inputs.brandKit.proofPoints,
    ...inputs.facts.map((fact) => fact.text),
  ]
    .filter((text) => typeof text === "string")
    .join(" ");
  const known = new Set(numbersIn(source));
  const sourceLower = source.toLowerCase();
  const tagSource = `${inputs.campaign.occasion ?? ""} ${inputs.campaign.angle ?? ""}`;
  const headlines = new Set<string>();

  for (const { index, copy } of copied) {
    const label = `candidate ${index}`;
    if (!copy) {
      problems.push(`${label}: no copy`);
      continue;
    }
    const { eyebrow, headline, cta } = copy;
    if (words(headline) < 1 || words(headline) > 6 || headline.length > 75) {
      problems.push(
        `${label}: headline "${headline}" breaks 6 words / 75 characters`,
      );
    }
    if (words(cta) < 1 || words(cta) > 3) {
      problems.push(`${label}: CTA "${cta}" breaks 3 words`);
    }
    if (eyebrow !== null) {
      if (words(eyebrow) + words(headline) > 8) {
        problems.push(`${label}: eyebrow and headline pass 8 words`);
      }
      if (eyebrow !== eyebrow.toUpperCase()) {
        problems.push(`${label}: eyebrow is not uppercase`);
      }
      if (tagSource.trim() === "") {
        problems.push(`${label}: eyebrow without a campaign`);
      }
    }
    for (const number of numbersIn(`${eyebrow ?? ""} ${headline} ${cta}`)) {
      if (!known.has(number))
        problems.push(`${label}: invented number ${number}`);
    }
    if (headlines.has(headline.toLowerCase())) {
      problems.push(`${label}: repeated headline`);
    }
    headlines.add(headline.toLowerCase());
    const text = `${eyebrow ?? ""} ${headline} ${cta}`.toLowerCase();
    for (const word of text.match(CLAIM_WORDS) ?? []) {
      const big = inputs.values.rating?.count ?? 0;
      const countOk =
        (word === "thousands" && big >= 1_000) ||
        (word === "millions" && big >= 1_000_000);
      if (!countOk && !sourceLower.includes(word)) {
        problems.push(`${label}: unconfirmed claim "${word}"`);
      }
    }
  }
  return problems;
}

function pinned(expect: Expect, planned: Candidate[], copied: Candidate[]) {
  const problems: string[] = [];
  const kept = copied.map((c) => c.index);
  const photos = new Set(planned.map((c) => c.photoId));
  if (
    expect.photoIds &&
    [...photos].sort().join() !== [...expect.photoIds].sort().join()
  ) {
    problems.push(`photos used: ${[...photos].join()}`);
  }
  for (const element of expect.noElements ?? []) {
    if (planned.some((c) => c.supportingElement === element)) {
      problems.push(`element ${element} was shown`);
    }
  }
  const offers = new Set(
    planned.flatMap((c) =>
      c.supportingElement === "offer" ? [c.offerFactId] : [],
    ),
  );
  if (expect.offerFactId && [...offers].join() !== expect.offerFactId) {
    problems.push(`offers used: ${[...offers].join()}`);
  }
  if (expect.angles) {
    const used = [...new Set(planned.map((c) => c.angle as string))].sort();
    if (used.join() !== [...expect.angles].sort().join()) {
      problems.push(`angles used: ${used.join()}`);
    }
  }
  if (expect.dropped) {
    const dropped = planned
      .map((c) => c.index)
      .filter((i) => !kept.includes(i));
    if (dropped.join() !== expect.dropped.join()) {
      problems.push(`dropped: ${dropped.join() || "none"}`);
    }
  }
  for (const [index, headline] of Object.entries(expect.headlines ?? {})) {
    const got = copied.find((c) => c.index === Number(index))?.copy?.headline;
    if (got !== headline) problems.push(`headline ${index}: "${got}"`);
  }
  for (const [index, element] of Object.entries(expect.elements ?? {})) {
    const got = copied.find(
      (c) => c.index === Number(index),
    )?.supportingElement;
    if (got !== element) problems.push(`element ${index}: ${got}`);
  }
  for (const [index, eyebrow] of Object.entries(expect.eyebrows ?? {})) {
    const copy = copied.find((c) => c.index === Number(index))?.copy;
    if (copy === undefined || copy?.eyebrow !== eyebrow) {
      problems.push(`eyebrow ${index}: ${JSON.stringify(copy?.eyebrow)}`);
    }
  }
  return problems;
}

export function roundProblems(
  inputs: RoundInputs,
  brief: BriefContent,
  expect: Expect,
  result: { planned: Candidate[]; copied: Candidate[] },
) {
  return [
    ...planProblems(inputs, brief, result.planned),
    ...copyProblems(inputs, result.copied),
    ...pinned(expect, result.planned, result.copied),
  ];
}
