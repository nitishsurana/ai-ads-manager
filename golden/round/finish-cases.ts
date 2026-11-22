import sharp from "sharp";
import { estimateGrade, finishProduct } from "@/lib/round/background/finish";
import {
  lightDirection,
  type LightDirection,
} from "@/lib/round/background/light";
import { same, type Case } from "./cases";

type Shade = (x: number, y: number) => number;

// A deterministic speckle of about ±2 grey levels, so a "flat" product has the texture a photo has.
const speckle = (x: number, y: number) => ((x * 7 + y * 13 + x * y) % 5) - 2;

// An elliptical grey product (transparent outside it) whose brightness is `shade`.
function ellipse(width: number, height: number, shade: Shade) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x + 0.5) / width - 0.5;
      const dy = (y + 0.5) / height - 0.5;
      const i = (y * width + x) * 4;
      const grey = Math.round(shade(x, y) + speckle(x, y));
      rgba.set([grey, grey, grey, dx * dx + dy * dy < 0.25 ? 255 : 0], i);
    }
  }
  return rgba;
}

const W = 240;
const H = 320;
// Brightness rising toward (ux, uy), a unit vector, from 75 to 225 across the box.
const lit =
  (ux: number, uy: number, strength = 1): Shade =>
  (x, y) =>
    150 *
    (1 + 0.5 * strength * (ux * (0.5 - x / W) * 2 + uy * (0.5 - y / H) * 2));
const S = Math.SQRT1_2;

const LIGHT_ROWS: [string, Shade, LightDirection | null][] = [
  ["flat light", () => 150, null],
  ["lit from the left", lit(1, 0), "left"],
  ["lit from the right", lit(-1, 0), "right"],
  ["lit from above", lit(0, 1), "above"],
  ["lit from the upper left", lit(S, S), "upper left"],
  ["lit from the upper right", lit(-S, S), "upper right"],
  ["lit from below gives none", lit(0, -1), null],
  ["lit from the lower left gives none", lit(S, -S), null],
  ["shading too weak to call", lit(1, 0, 0.1), null],
  [
    "three parts of different albedo side by side, each mildly textured",
    (x) => [80, 140, 100][Math.floor((3 * x) / W)] ?? 100,
    null,
  ],
  [
    "a strong gradient in the left part and the opposite in the right part",
    (x) =>
      x < 0.6 * W
        ? 200 - (x / (0.6 * W)) * 100
        : 100 + ((x - 0.6 * W) / (0.4 * W)) * 30,
    null,
  ],
];

type Rgb = [number, number, number];

// A 100 x 100 scene read pixel by pixel; `inBox` is the 20 x 20 square the product covers.
function scene(pixel: (x: number, y: number, inBox: boolean) => Rgb) {
  const data = Buffer.alloc(100 * 100 * 3);
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      const inBox = x >= 40 && x < 60 && y >= 40 && y < 60;
      data.set(pixel(x, y, inBox), (y * 100 + x) * 3);
    }
  }
  return { data, width: 100, height: 100 };
}

const BOX = { x: 40, y: 40, w: 20, h: 20 };
const PRODUCT = { rgba: Buffer.alloc(BOX.w * BOX.h * 4, 255), box: BOX };
const NO_PRODUCT = { rgba: Buffer.alloc(BOX.w * BOX.h * 4), box: BOX };
const flat = (colour: Rgb) => scene(() => colour);

const GRADE_ROWS: [
  string,
  ReturnType<typeof scene>,
  typeof PRODUCT,
  number[],
][] = [
  [
    "a neutral scene leaves the product as it is",
    flat([128, 128, 128]),
    PRODUCT,
    [1, 1, 1],
  ],
  [
    "a warm cast pulls the product warm",
    flat([180, 170, 160]),
    PRODUCT,
    [1.025, 0.996, 0.967],
  ],
  [
    "a cool cast pulls it cool",
    flat([160, 170, 180]),
    PRODUCT,
    [0.975, 1.004, 1.034],
  ],
  [
    "a strong cast is shrunk uniformly to 0.06",
    flat([200, 171, 171]),
    PRODUCT,
    [1.06, 0.984, 0.984],
  ],
  [
    "the product's own pixels are left out of the cast",
    scene((_x, _y, inBox) => (inBox ? [160, 170, 180] : [180, 170, 160])),
    PRODUCT,
    [1.025, 0.996, 0.967],
  ],
  [
    "the same pixels count where the product is transparent",
    scene((_x, _y, inBox) => (inBox ? [160, 170, 180] : [180, 170, 160])),
    NO_PRODUCT,
    [1.023, 0.996, 0.969],
  ],
  [
    "clipped, dark and saturated pixels don't count, and under 5% neutral gives none",
    scene((x, y) =>
      y < 40
        ? [255, 250, 250]
        : y < 60
          ? [10, 10, 10]
          : y < 96
            ? [240, 40, 40]
            : [180, 170, 160],
    ),
    NO_PRODUCT,
    [1, 1, 1],
  ],
];

const alphaRows = async (png: Buffer) => {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Array.from({ length: info.height }, (_, y) =>
    Array.from(
      { length: info.width },
      (_, x) => data[(y * info.width + x) * 4 + 3],
    ).join(" "),
  );
};

const picture = (
  width: number,
  height: number,
  alpha: (x: number, y: number) => number,
) => {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      rgba.set([200, 100, 50, alpha(x, y)], (y * width + x) * 4);
    }
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
};

// The left-lit ellipse with everything outside `keep` made transparent.
function litParts(keep: (x: number, y: number) => boolean) {
  const rgba = ellipse(W, H, lit(1, 0));
  for (let i = 0; i < W * H; i++) {
    if (!keep(i % W, Math.floor(i / W))) rgba[i * 4 + 3] = 0;
  }
  return rgba;
}

export const FINISH_CASES: Case[] = [
  {
    name: "light direction: two separated parts, each lit from the left, give none; one part with a speck under 5% beside it keeps its direction",
    run: () =>
      same(
        [
          lightDirection(
            litParts((x) => x < 0.45 * W || x >= 0.55 * W),
            W,
            H,
          ),
          lightDirection(
            litParts(
              (x, y) =>
                x < 0.8 * W ||
                (x >= 0.9 * W && x < 0.9 * W + 8 && y > 150 && y < 158),
            ),
            W,
            H,
          ),
        ],
        [null, "left"],
      ),
  },
  ...LIGHT_ROWS.map(([name, shade, expected]) => ({
    name: `light direction: ${name}`,
    run: () => same(lightDirection(ellipse(W, H, shade), W, H), expected),
  })),
  ...GRADE_ROWS.map(([name, scene, product, expected]) => ({
    name: `grade: ${name}`,
    run: () => same(estimateGrade(scene, product), expected),
  })),
  {
    name: "finish: the grade scales the colours, and the outer two rings of the silhouette ramp down to 0.5 and 0.85 of their alpha, with the box edge as an outside",
    run: async () => {
      const inner = await picture(6, 6, () => 255);
      const bordered = await picture(8, 8, (x, y) =>
        x === 0 || y === 0 || x === 7 || y === 7 ? 5 : x === 1 ? 100 : 255,
      );
      const { data } = await sharp(await finishProduct(inner, [1.05, 1, 0.95]))
        .raw()
        .toBuffer({ resolveWithObject: true });
      return same(
        [
          Array.from(data.subarray(0, 4)),
          await alphaRows(await finishProduct(inner, [1, 1, 1])),
          await alphaRows(await finishProduct(bordered, [1, 1, 1])),
        ],
        [
          [210, 100, 48, 128],
          [
            "128 128 128 128 128 128",
            "128 217 217 217 217 128",
            "128 217 255 255 217 128",
            "128 217 255 255 217 128",
            "128 217 217 217 217 128",
            "128 128 128 128 128 128",
          ],
          [
            "5 5 5 5 5 5 5 5",
            "5 50 128 128 128 128 128 5",
            "5 50 217 217 217 217 128 5",
            "5 50 217 255 255 217 128 5",
            "5 50 217 255 255 217 128 5",
            "5 50 217 217 217 217 128 5",
            "5 50 128 128 128 128 128 5",
            "5 5 5 5 5 5 5 5",
          ],
        ],
      );
    },
  },
];
