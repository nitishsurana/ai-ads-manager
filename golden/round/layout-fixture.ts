import type { Layout } from "@/lib/render";

export const text = (
  box: { x: number; y: number; w: number; h: number },
  colour: string,
  lines: string[],
) => ({
  box,
  font: { family: "Inter", weight: 700 as const, fallback: false },
  size: 80,
  colour,
  lines,
  lineHeight: 1.05,
  tracking: 0,
});

export const LAYOUT: Layout = {
  version: 1,
  offerFactId: null,
  fonts: { Inter: "1" },
  method: "tonal",
  product: null,
  scrim: null,
  eyebrow: null,
  headline: {
    ...text({ x: 65, y: 200, w: 900, h: 200 }, "#ffffff", ["Slow mornings"]),
    contrast: 7,
  },
  cta: {
    ...text({ x: 300, y: 1500, w: 480, h: 120 }, "#ffffff", ["Shop now"]),
    background: "#d0006f",
    radius: 60,
    deltaE: 40,
    contrast: 6,
  },
  badge: null,
  logo: null,
  dropped: [],
};

export const BADGE = (
  kind: "price" | "rating" | "offer",
  rows: NonNullable<Layout["badge"]>["rows"],
) => ({
  kind,
  box: { x: 700, y: 600, w: 300, h: 160 },
  font: { family: "Inter", weight: 700 as const, fallback: false },
  background: "#ffffff",
  colour: "#111111",
  radius: 20,
  rows,
});

export const row = (
  text: string,
  over: Partial<{ strike: boolean; star: boolean }> = {},
) => ({
  text,
  size: 60,
  weight: 700 as const,
  strike: false,
  star: false,
  ...over,
});
