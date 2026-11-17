import { DESIGN } from "./canvas";
import { fitText, sizeRange } from "./fit";
import type { Measure } from "./measure";
import type { BadgeLayout } from "./layout";

export type BadgeSpec =
  | { kind: "price"; price: string; was: string | null; currency: string }
  | { kind: "rating"; value: number; count: number }
  | { kind: "offer"; text: string };

type Row = BadgeLayout["rows"][number];

export const OFFER_MAX_CHARS = 40;
export const ROW_LINE_HEIGHT = 1.1;
const MAX_INNER = 330;
export const ROW_GAP = 8;
const SCALES = [1, 0.9, 0.8, 0.7, 0.6, 0.5] as const;

// A confirmed price may come without its symbol ("70.00" with the currency USD); the badge always shows one.
export function withSymbol(price: string, currency: string) {
  if (/[^\d\s.,]/.test(price)) return price;
  const symbol = new Intl.NumberFormat("en", { style: "currency", currency })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value;
  return `${symbol ?? currency} ${price}`;
}

const row = (
  text: string,
  size: number,
  weight: Row["weight"],
  options: Partial<Pick<Row, "strike" | "star">> = {},
): Row => ({
  text,
  size: Math.round(size),
  weight,
  strike: options.strike ?? false,
  star: options.star ?? false,
});

const rowHeight = (size: number) => Math.ceil(size * ROW_LINE_HEIGHT);

// Rows are laid out at the design's sizes and scaled down together until the widest fits.
function scaled(
  build: (scale: number) => { rows: Row[]; width: number },
  maxInner: number,
) {
  for (const scale of SCALES) {
    const built = build(scale);
    if (built.width <= maxInner) return built;
  }
  return build(SCALES.at(-1) ?? 0.5);
}

export type PlannedBadge =
  | { ok: true; w: number; h: number; rows: Row[] }
  | { ok: false; reason: string };

export function planBadge(spec: BadgeSpec, measure: Measure): PlannedBadge {
  const padX = DESIGN.badgePadX;
  const padY = DESIGN.badgePadY;
  const frame = (rows: Row[], inner: number) => ({
    ok: true as const,
    rows,
    w: Math.ceil(inner + 2 * padX),
    h: Math.ceil(
      rows.reduce((sum, r) => sum + rowHeight(r.size), 0) +
        ROW_GAP * (rows.length - 1) +
        2 * padY,
    ),
  });

  if (spec.kind === "offer") {
    if (spec.text.length > OFFER_MAX_CHARS) {
      return {
        ok: false,
        reason: `offer is over ${OFFER_MAX_CHARS} characters`,
      };
    }
    const fit = fitText(spec.text, measure, {
      maxWidth: MAX_INNER,
      maxLines: 4,
      sizes: sizeRange(DESIGN.badgePrice * 0.7, 24, 2),
      weight: 700,
    });
    const rows = fit.lines.map((line) => row(line, fit.size, 700));
    const inner = Math.max(
      ...fit.lines.map((line) => measure(line, fit.size, 700)),
    );
    return frame(rows, inner);
  }

  if (spec.kind === "price") {
    const price = withSymbol(spec.price, spec.currency);
    const was = spec.was ? withSymbol(spec.was, spec.currency) : null;
    const built = scaled((scale) => {
      const big = DESIGN.badgePrice * scale;
      const small = DESIGN.badgeSub * scale;
      return {
        rows: [
          row(price, big, 700),
          ...(was ? [row(was, small, 400, { strike: true })] : []),
        ],
        width: Math.max(
          measure(price, big, 700),
          was ? measure(was, small, 400) : 0,
        ),
      };
    }, MAX_INNER);
    return frame(built.rows, built.width);
  }

  const value = spec.value.toFixed(1);
  const count = `${spec.count.toLocaleString("en-US")} reviews`;
  const built = scaled((scale) => {
    const big = DESIGN.badgePrice * scale;
    const small = DESIGN.badgeSub * scale;
    return {
      rows: [row(value, big, 700, { star: true }), row(count, small, 400)],
      // The star is drawn as wide as the number is tall, with a gap of a quarter of that.
      width: Math.max(
        big * 1.25 + measure(value, big, 700),
        measure(count, small, 400),
      ),
    };
  }, MAX_INNER);
  return frame(built.rows, built.width);
}
