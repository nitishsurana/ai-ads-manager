import type { RoundInputs } from "../inputs";
import type { Copy } from "../types";
import {
  COPY_WORDS,
  CTA_WORDS,
  HEADLINE_CHARS,
  HEADLINE_WORDS,
} from "./limits";

export { COPY_WORDS, CTA_WORDS, HEADLINE_CHARS, HEADLINE_WORDS };

const words = (text: string) => text.split(/\s+/).filter(Boolean);
// Hyphenated and apostrophe compounds stay whole, so "cruelty-free" is not "free".
const tokens = (text: string) =>
  text.toLowerCase().match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu) ?? [];
const plainTokens = (text: string) =>
  text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

// Thousands separators go, so "9,951" and "9951" are one number.
const numbers = (text: string) =>
  (text.replace(/(\d),(?=\d{3})/g, "$1").match(/\d+(?:\.\d+)?/g) ?? []).map(
    (number) => String(Number(number)),
  );

// Digit-less discount, urgency, superlative, award and health words. Each needs the confirmed facts to use it too; "thousands" and "millions" also pass on a big enough rating count.
const CLAIM_WORD =
  /^(off|save|saves|saving|savings|half|bogo|limited|only|warranty|lifetime|guarantee\w*|award\w*|top-rated|bestselling|best-selling|best|finest|world's|doctor\w*|dermatologist\w*|clinically|recommended|cure[sd]?|heal\w*|relief|thousands|millions|cheapest|lowest|sale|discount\w*|deals?|clearance|miracle|unbeatable|proven)$/;
const COUNT_WORDS: Record<string, number> = {
  thousands: 1_000,
  millions: 1_000_000,
};

const PERSONALIZE_CTA =
  /personali[sz]|customi[sz]|make it yours|(?:design|create) (?:yours|your own)/i;

export type CopyFailure = {
  part: "eyebrow" | "headline" | "cta" | "claim";
  text: string;
};

// What copy may state: the product, the confirmed values and facts, and the brand kit the tester confirmed. The campaign is context, not a fact.
export function sourceText(inputs: RoundInputs) {
  const { values, brandKit, facts } = inputs;
  return [
    inputs.productTitle,
    values.price,
    values.wasPrice,
    values.rating && `${values.rating.value} ${values.rating.count}`,
    values.brandName,
    brandKit.audience,
    ...brandKit.valuePropositions,
    ...brandKit.proofPoints,
    ...facts.map((fact) => fact.text),
  ]
    .filter((text) => typeof text === "string")
    .join("\n");
}

export function claimsIn(text: string, inputs: RoundInputs) {
  const source = sourceText(inputs);
  const sourceTokens = tokens(source);
  const sourceWords = new Set(sourceTokens);
  const pairs = new Set(
    sourceTokens.slice(1).map((token, i) => `${sourceTokens[i]} ${token}`),
  );
  const sourceNumbers = new Set(numbers(source));
  const written = tokens(text);
  const count = inputs.values.rating?.count ?? 0;
  const claims = [
    ...numbers(text).filter((number) => !sourceNumbers.has(number)),
    ...written.filter((token) => {
      if (!CLAIM_WORD.test(token) || sourceWords.has(token)) return false;
      return count < (COUNT_WORDS[token] ?? Infinity);
    }),
    ...written.flatMap((token, i) => {
      if (token !== "free") return [];
      const near = [
        written[i + 1] && `free ${written[i + 1]}`,
        written[i - 1] && `${written[i - 1]} free`,
      ];
      return near.some((pair) => pair && pairs.has(pair)) ? [] : ["free"];
    }),
  ];
  const joined = written.join(" ");
  if (
    joined.includes("buy one get one") &&
    !tokens(source).join(" ").includes("buy one get one")
  ) {
    claims.push("buy one get one");
  }
  if (/#\s?1\b/.test(text) && !source.includes("#1")) claims.push("#1");
  return claims;
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "your",
  "you",
  "our",
  "her",
  "his",
  "its",
  "day",
  "days",
  "new",
]);

export function checkCopy(copy: Copy, inputs: RoundInputs): CopyFailure[] {
  const failures: CopyFailure[] = [];
  const headline = copy.headline.trim();
  const headlineWords = words(headline).length;
  if (headlineWords === 0)
    failures.push({ part: "headline", text: "the headline is empty" });
  if (headlineWords > HEADLINE_WORDS) {
    failures.push({
      part: "headline",
      text: `the headline has ${headlineWords} words; the limit is ${HEADLINE_WORDS}`,
    });
  }
  if (headline.length > HEADLINE_CHARS) {
    failures.push({
      part: "headline",
      text: `the headline has ${headline.length} characters; the limit is ${HEADLINE_CHARS}`,
    });
  }
  const ctaWords = words(copy.cta).length;
  if (ctaWords === 0 || ctaWords > CTA_WORDS) {
    failures.push({
      part: "cta",
      text: `the CTA has ${ctaWords} words; it needs 1 to ${CTA_WORDS}`,
    });
  }

  if (inputs.orderFlow === "personalize" && !PERSONALIZE_CTA.test(copy.cta)) {
    failures.push({
      part: "cta",
      text: 'the CTA must invite the shopper to personalize the product, such as "Personalize yours"',
    });
  }

  const eyebrowWords = copy.eyebrow ? words(copy.eyebrow).length : 0;
  if (eyebrowWords + headlineWords > COPY_WORDS) {
    failures.push({
      part: "eyebrow",
      text: `the eyebrow and headline have ${eyebrowWords + headlineWords} words together; the limit is ${COPY_WORDS}`,
    });
  }
  if (copy.eyebrow) {
    const tag = new Set(
      plainTokens(
        `${inputs.campaign.occasion ?? ""} ${inputs.campaign.angle ?? ""}`,
      ),
    );
    const shared = plainTokens(copy.eyebrow).some(
      (token) => token.length >= 3 && !STOPWORDS.has(token) && tag.has(token),
    );
    if (!shared) {
      failures.push({
        part: "eyebrow",
        text: "the eyebrow is not a campaign tag",
      });
    }
    const eyebrowClaims = claimsIn(copy.eyebrow, inputs);
    if (eyebrowClaims.length > 0) {
      failures.push({
        part: "eyebrow",
        text: `${eyebrowClaims.join(", ")} is not in the confirmed facts`,
      });
    }
  }

  const claims = claimsIn(`${headline}\n${copy.cta}`, inputs);
  if (claims.length > 0) {
    failures.push({
      part: "claim",
      text: `${claims.join(", ")} is not in the confirmed facts`,
    });
  }
  return failures;
}
