import {
  applyAnswers,
  canGenerate,
  confirmedBrandName,
  confirmedLogoSource,
  confirmedPrices,
  confirmMessages,
  initialConfirm,
} from "@/lib/confirm";
import type { IntakeResult } from "@/lib/intake";
import { parseAmount } from "@/lib/money";
import type {
  ConfirmExpectation,
  ConfirmScript,
  Expectation,
} from "./expectations";
import { parseS1 } from "./s1-answers";

export type ConfirmRun = {
  // The scenario name; null for the CSV row's own answers.
  name: string | null;
  problems: string[];
  observed: ConfirmExpectation & { currency: string };
  expected: ConfirmExpectation & { currency: string };
};

const distinct = (values: string[]) => [...new Set(values)].sort();

// The CSV's "Confirm $X" means the screen surfaces X; compare amounts, since the page may print $20.00 where the CSV says $20.
function surfaced(csv: string | undefined, shown: string | null) {
  if (csv === undefined) return null;
  return shown !== null && parseAmount(csv) === parseAmount(shown)
    ? null
    : `S1 confirms ${csv} but the screen surfaces ${shown}`;
}

function runScript(
  name: string | null,
  script: ConfirmScript,
  result: IntakeResult,
): ConfirmRun {
  const parsed = parseS1(script.s1, script.deselectPositions ?? []);
  const start = initialConfirm(result);
  const problems = [
    surfaced(parsed.confirms.price, start.price),
    surfaced(parsed.confirms.wasPrice, start.wasPrice),
    parsed.ratingDefault !== undefined &&
    parsed.ratingDefault !== start.showRating
      ? `S1 assumes a rating default of ${parsed.ratingDefault ? "on" : "off"} but the screen starts with rating ${start.showRating ? "on" : "off"}`
      : null,
    parsed.wasPriceEmpty && start.wasPrice !== null
      ? `S1 leaves the strike-through empty but the screen prefilled ${start.wasPrice}`
      : null,
  ].filter((text) => text !== null);

  const state = applyAnswers(start, parsed.answers);
  const shown = state.photos.filter((photo) => photo.selected);
  const warned = (code: string) =>
    shown
      .filter((photo) => photo.warnings.some((w) => w === code))
      .map((photo) => photo.position);
  const prices = confirmedPrices(state);
  return {
    name,
    problems,
    observed: {
      messages: distinct(
        confirmMessages(state).map((m) => `Warning: ${m.text}`),
      ),
      canGenerate: canGenerate(state),
      price: prices.price,
      wasPrice: prices.wasPrice,
      currency: prices.currency,
      currencies: state.currencies,
      showRating: state.showRating,
      selectedCount: shown.length,
      brandName: confirmedBrandName(state),
      logoSource: confirmedLogoSource(state),
      tone: state.brandKit.tone,
      lowResPositions: warned("low_resolution"),
      textPositions: warned("photo_text"),
    },
    expected: {
      ...script.confirm,
      messages: distinct(script.confirm.messages),
      currency: parsed.currency ?? start.currency,
    },
  };
}

export function runConfirm(
  expected: Expectation,
  result: IntakeResult,
): ConfirmRun[] {
  return [
    ...(expected.confirmed
      ? [runScript(null, expected.confirmed, result)]
      : []),
    ...Object.entries(expected.scenarios ?? {}).map(([name, script]) =>
      runScript(name, script, result),
    ),
  ];
}
