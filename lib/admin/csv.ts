import type { AdminRound } from "./types";

// Excel reads a CSV as the local code page unless it starts with this mark.
const BOM = "\uFEFF";

const HEADER = [
  "tester",
  "workspace",
  "product URL",
  "round",
  "creative n",
  "angle",
  "rating",
  "tags",
  "note",
  "edited",
  "judge mean of medians",
  "low confidence",
  "round cost",
];

// A cell a spreadsheet would read as a formula gets a leading apostrophe; quoting follows CSV rules.
function cell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const yesNo = (value: boolean) => (value ? "yes" : "no");

function rows(round: AdminRound) {
  const label =
    round.n === null
      ? ""
      : round.attempt > 1
        ? `${round.n} (attempt ${round.attempt})`
        : String(round.n);
  const shared = [round.tester, round.title, round.sourceUrl, label];
  const cost = round.cost.toFixed(4);
  if (round.creatives.length === 0) {
    return [[...shared, "", "", "", "", "", "", "", "", cost]];
  }
  return round.creatives.map((c) => [
    ...shared,
    c.n,
    c.angle,
    c.rating ?? "",
    c.tags.join("; "),
    c.note ?? "",
    yesNo(c.edits > 0),
    c.judge ? c.judge.mean.toFixed(2) : "",
    c.judge ? yesNo(c.judge.lowConfidence) : "",
    cost,
  ]);
}

export function toCsv(rounds: AdminRound[]) {
  return (
    BOM +
    [HEADER, ...rounds.flatMap(rows)]
      .map((row) => row.map(cell).join(","))
      .join("\r\n") +
    "\r\n"
  );
}
