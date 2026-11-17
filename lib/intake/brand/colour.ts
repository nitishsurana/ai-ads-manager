import { COLOUR_NAMES } from "./colour-names";

export type Rgb = [number, number, number];

const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)));

const hex2 = (n: number) => clamp(n).toString(16).padStart(2, "0");

export const toHex = ([r, g, b]: Rgb) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

export function fromHex(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Theme settings arrive as "#fff", "rgb(0 0 0)", "0, 0, 0" or "0 0 0" (channel triplets) or a colour name. Anything else is not read: hsl, gradients, unresolved var(), and any colour with transparency, which is a tint of something else rather than a brand colour.
export function parseColour(value: string): Rgb | null {
  const text = value
    .trim()
    .toLowerCase()
    .replace(/\s*!important$/, "");
  if (Object.hasOwn(COLOUR_NAMES, text)) {
    return fromHex(COLOUR_NAMES[text] as string);
  }

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/.exec(text);
  if (hex) {
    if (hex[2] !== undefined && hex[2] !== "ff") return null;
    const digits = hex[1] ?? "";
    const full =
      digits.length === 3 ? [...digits].map((c) => c + c).join("") : digits;
    return fromHex(`#${full}`);
  }

  const channels =
    /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?/.exec(
      text,
    ) ??
    /^([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)$/.exec(text) ??
    /^([\d.]+)\s+([\d.]+)\s+([\d.]+)$/.exec(text);
  if (!channels) return null;
  const alpha = channels[4];
  if (alpha !== undefined) {
    const value = alpha.endsWith("%")
      ? parseFloat(alpha) / 100
      : parseFloat(alpha);
    if (value < 1) return null;
  }
  const [r, g, b] = channels
    .slice(1, 4)
    .map((c) =>
      c.endsWith("%") ? (parseFloat(c) * 255) / 100 : parseFloat(c),
    );
  return [clamp(r ?? 0), clamp(g ?? 0), clamp(b ?? 0)];
}

function luminance([r, g, b]: Rgb) {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}
