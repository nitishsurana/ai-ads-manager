import { contrast, fromHex, toHex, type Rgb } from "@/lib/intake";

export { contrast, fromHex, toHex, type Rgb };

export const LIGHT_INK: Rgb = [255, 255, 255];
export const DARK_INK: Rgb = [17, 17, 17];

function linear(c: number) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

// CIE L*a*b* under D65, for ΔE.
export function toLab([r, g, b]: Rgb): [number, number, number] {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)] as const;
  const x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047;
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  const [fx, fy, fz] = [f(x), f(y), f(z)] as const;
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// CIE76: the straight distance in L*a*b*.
export function deltaE(a: Rgb, b: Rgb) {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export function minDeltaE(colour: Rgb, others: readonly Rgb[]) {
  return Math.min(Infinity, ...others.map((other) => deltaE(colour, other)));
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as Rgb;
}

export function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [nr, ng, nb] = [r / 255, g / 255, b / 255] as const;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === nr
      ? ((ng - nb) / d) % 6
      : max === ng
        ? (nb - nr) / d + 2
        : (nr - ng) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

// What the pixels behind a box look like: the mean, and the colours at the 2nd and 98th brightness percentiles, so a busy area counts at its worst.
export type Backdrop = {
  mean: Rgb;
  dark: Rgb;
  light: Rgb;
  // Standard deviation of brightness: how busy the area is.
  busy: number;
};

export const flatBackdrop = (colour: Rgb): Backdrop => ({
  mean: colour,
  dark: colour,
  light: colour,
  busy: 0,
});

export function worstContrast(ink: Rgb, backdrop: Backdrop) {
  return Math.min(
    contrast(ink, backdrop.mean),
    contrast(ink, backdrop.dark),
    contrast(ink, backdrop.light),
  );
}

export function worstOf(colours: readonly Rgb[], backdrop: Backdrop) {
  return Math.min(
    Infinity,
    ...colours.map((colour) => worstContrast(colour, backdrop)),
  );
}

// The candidate with the best worst-case contrast; ties keep the earlier one.
export function bestInk(candidates: readonly Rgb[], backdrop: Backdrop) {
  let best = { ink: candidates[0] ?? LIGHT_INK, ratio: -1 };
  for (const ink of candidates) {
    const ratio = worstContrast(ink, backdrop);
    if (ratio > best.ratio) best = { ink, ratio };
  }
  return best;
}

export const hexOf = toHex;
