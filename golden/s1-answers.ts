import type { Answers } from "@/lib/confirm";
import type { S1 } from "./expectations";

export type ParsedS1 = {
  answers: Answers;
  // What the CSV says the tester confirms: the app must surface these values.
  confirms: { price?: string; wasPrice?: string };
  // The CSV leaves the strike-through empty: the screen must not have prefilled one.
  wasPriceEmpty: boolean;
  // Null when the S1 currency column says n/a: the currency stays as the page showed it.
  currency: string | null;
  // The rating default the CSV answer implies: a plain Yes or No confirms the default, an override says the opposite.
  ratingDefault?: boolean;
};

// Every pattern is anchored; the CSV's own strings may end in one parenthetical note.
const NOTE = String.raw`(?: \([^)]*\))?`;
// "n/a (store name found in header)" is a real CSV string, so n/a takes one parenthetical note too.

function match(text: string, pattern: RegExp, column: string) {
  const found = pattern.exec(text.trim());
  if (!found) throw new Error(`S1 ${column}: can't parse "${text}"`);
  return found;
}

const isNa = (text: string) => new RegExp(`^n/a${NOTE}$`).test(text.trim());

function yesNo(text: string, column: string) {
  if (isNa(text)) return undefined;
  return match(text, /^(Yes|No)$/, column)[1] === "Yes";
}

function priceAnswers(s1: S1, parsed: ParsedS1) {
  const show = yesNo(s1.showPrice, "show price");
  const text = s1.price.trim();
  if (show === undefined) {
    if (!isNa(text))
      throw new Error(`S1 price to use: "${text}" but show price is n/a`);
    return;
  }
  if (!show) {
    if (!isNa(text))
      throw new Error(`S1 price to use: "${text}" but no price is shown`);
    parsed.answers.price = { show: false };
    return;
  }
  const confirm = new RegExp(`^Confirm (\\S+)$`).exec(text);
  const edit = new RegExp(`^Edit to (\\S+)${NOTE}$`).exec(text);
  const switched = /^Switch currency to ([A-Z]{3}), enter (\S+)$/.exec(text);
  if (confirm?.[1]) parsed.confirms.price = confirm[1];
  else if (edit?.[1]) parsed.answers.price = { show: true, value: edit[1] };
  else if (switched?.[1] && switched[2]) {
    parsed.answers.currency = { code: switched[1], price: switched[2] };
  } else throw new Error(`S1 price to use: can't parse "${text}"`);
  parsed.answers.price ??= { show: true };
}

function wasPriceAnswers(s1: S1, parsed: ParsedS1) {
  const text = s1.wasPrice.trim();
  if (isNa(text)) return;
  if (text === "Leave empty") {
    parsed.wasPriceEmpty = true;
    return;
  }
  if (/^No \(override[^)]*\)$/.test(text)) {
    parsed.answers.wasPrice = { show: false };
    return;
  }
  const added = /^Yes \(add (\S+?);[^)]*\)$/.exec(text);
  const confirmed = /^Yes \((\S+)\)$/.exec(text);
  if (added?.[1]) parsed.answers.wasPrice = { show: true, value: added[1] };
  else if (confirmed?.[1]) {
    parsed.answers.wasPrice = { show: true };
    parsed.confirms.wasPrice = confirmed[1];
  } else if (text === "Yes") parsed.answers.wasPrice = { show: true };
  else throw new Error(`S1 show strike-through: can't parse "${text}"`);
}

function ratingAnswers(s1: S1, parsed: ParsedS1) {
  if (isNa(s1.rating)) return;
  const found = match(
    s1.rating,
    /^(Yes|No)(?: \(override: default (on|off)\))?$/,
    "show rating",
  );
  const show = found[1] === "Yes";
  // An override answers against the default, so "Yes (override: default on)" contradicts itself.
  if (found[2] && (found[2] === "on") === show) {
    throw new Error(`S1 show rating: "${s1.rating}" contradicts itself`);
  }
  parsed.answers.showRating = show;
  parsed.ratingDefault = found[2] ? found[2] === "on" : show;
}

function brandAnswers(s1: S1, parsed: ParsedS1) {
  const name = s1.brandName.trim();
  if (name === "Leave blank") parsed.answers.brandName = "";
  else if (!isNa(name)) {
    parsed.answers.brandName = match(
      name,
      /^Enter '([^']+)'$/,
      "brand name",
    )[1];
  }
  const kit = s1.brandKit.trim();
  if (kit === "none") return;
  const tone = match(kit, /^Edit tone to '([^']+)'$/, "brand kit change")[1];
  const words = (tone ?? "").split(",").map((word) => word.trim());
  if (words.some((word) => word === "")) {
    throw new Error(`S1 brand kit change: empty tone word in "${kit}"`);
  }
  parsed.answers.brandKit = { tone: words };
}

export function parseS1(s1: S1, deselectPositions: number[]): ParsedS1 {
  const parsed: ParsedS1 = {
    answers: {},
    confirms: {},
    wasPriceEmpty: false,
    currency: isNa(s1.currency)
      ? null
      : (match(s1.currency, new RegExp(`^([A-Z]{3})${NOTE}$`), "currency")[1] ??
        null),
  };
  const proceed = yesNo(s1.continue, "continue if flagged");
  if (proceed !== undefined) parsed.answers.continuePastFlag = proceed;
  if (s1.deselect.trim() !== "none") {
    if (deselectPositions.length === 0) {
      throw new Error(
        `S1 photos to deselect: "${s1.deselect}" has no positions`,
      );
    }
    parsed.answers.deselect = deselectPositions;
  }
  priceAnswers(s1, parsed);
  wasPriceAnswers(s1, parsed);
  ratingAnswers(s1, parsed);
  brandAnswers(s1, parsed);
  if (s1.variant) {
    const found = match(s1.variant, /^Choose (\d+)(, confirmed)?$/, "variant");
    parsed.answers.variantId = Number(found[1]);
    if (found[2]) parsed.answers.variantConfirmed = true;
  }
  return parsed;
}
