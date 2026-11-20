import sharp from "sharp";
import { borderProblems, productProblems } from "@/lib/round/checks/pixels";
import {
  normalise,
  readbackProblems,
  type Readback,
} from "@/lib/round/checks/readback";
import { creativeFileName } from "@/lib/round/file-name";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createMeasure,
  currentVersions,
  loadFonts,
  nodeProblems,
  placeLogo,
} from "@/lib/render";
import { renderTextLayer } from "@/lib/render/text-layer";
import { flatBackdrop } from "@/lib/render/colour";
import { createFontReplayHttp, FONT_FIXTURES } from "@/lib/providers/http";
import { createLocalStorage } from "@/lib/providers/storage";
import { same, type Case } from "./cases";
import { BADGE, LAYOUT, row } from "./layout-fixture";

const readback = (over: Partial<Readback> = {}): Readback => ({
  eyebrow: null,
  headline: "Slow mornings",
  cta: "Shop now",
  badge: [],
  ...over,
});

const READBACK_CASES: Case[] = [
  {
    name: "read-back: case, spacing, curly quotes, dashes and the star glyph are normalised",
    run: () =>
      same(
        [
          normalise("Spring Edit") === normalise("SPRING EDIT"),
          normalise("$ 70.00") === normalise("$70.00"),
          normalise("It’s ours – now") === normalise("It's ours - now"),
          normalise("★ 4.7") === normalise("*4.7"),
          normalise("1,284 reviews") === normalise("1,248 reviews"),
        ],
        [true, true, true, true, false],
      ),
  },
  {
    name: "read-back: matching text passes; a changed headline or CTA fails with what was read",
    run: () =>
      same(
        [
          readbackProblems(LAYOUT, readback({ headline: "SLOW MORNINGS" })),
          readbackProblems(LAYOUT, readback({ headline: "Slow mornin" }))
            .length,
          readbackProblems(LAYOUT, readback({ cta: null })).length,
        ],
        [[], 1, 1],
      ),
  },
  {
    name: "read-back: the badge compares line by line, the star as ★ and the struck-through price as its own field",
    run: () => {
      const price = {
        ...LAYOUT,
        badge: BADGE("price", [row("$24.00"), row("$30.00", { strike: true })]),
      };
      const rating = {
        ...LAYOUT,
        badge: BADGE("rating", [
          row("4.7", { star: true }),
          row("1,284 reviews"),
        ]),
      };
      const line = (text: string, struck = false, star = false) => ({
        text,
        struck_through: struck,
        has_star: star,
      });
      return same(
        [
          readbackProblems(
            price,
            readback({ badge: [line("$24.00"), line("$30.00", true)] }),
          ),
          readbackProblems(
            price,
            readback({ badge: [line("$24.00"), line("$30.00")] }),
          ).length,
          readbackProblems(price, readback({ badge: [line("$24.00")] })).length,
          readbackProblems(
            rating,
            readback({
              badge: [line("4.7", false, true), line("1,284 reviews")],
            }),
          ),
          readbackProblems(
            rating,
            readback({ badge: [line("★ 4.7"), line("1,284 reviews")] }),
          ),
          readbackProblems(
            rating,
            readback({ badge: [line("4.7"), line("1,284 reviews")] }),
          ).length,
        ],
        [[], 1, 1, [], [], 1],
      );
    },
  },
  {
    name: "read-back: an offer badge compares as one text whatever its line breaks",
    run: () => {
      const offer = {
        ...LAYOUT,
        badge: BADGE("offer", [row("Free shipping"), row("over $50")]),
      };
      const line = (text: string) => ({
        text,
        struck_through: false,
        has_star: false,
      });
      return same(
        [
          readbackProblems(
            offer,
            readback({ badge: [line("Free shipping over $50")] }),
          ),
          readbackProblems(
            offer,
            readback({ badge: [line("Free shipping over $5")] }),
          ).length,
        ],
        [[], 1],
      );
    },
  },
];

const frame = async (edges: ("top" | "bottom" | "left" | "right")[]) => {
  const width = 1080;
  const height = 1920;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const grey = 90 + Math.round((y / height) * 60);
      const inFrame =
        (edges.includes("top") && y < 16) ||
        (edges.includes("bottom") && y >= height - 16) ||
        (edges.includes("left") && x < 16) ||
        (edges.includes("right") && x >= width - 16);
      const [r, g, b] = inFrame ? [208, 0, 111] : [grey, grey, grey];
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
  return { data, width, height };
};

const BORDER_CASES: Case[] = [
  {
    name: "layer 1 border: a smooth vertical gradient has none",
    run: async () => same(borderProblems(await frame([])), []),
  },
  {
    name: "layer 1 border: a flat frame on all four edges is found; one edge alone is not a frame",
    run: async () =>
      same(
        [
          borderProblems(await frame(["top", "bottom", "left", "right"]))
            .length,
          borderProblems(await frame(["top"])).length,
        ],
        [1, 0],
      ),
  },
];

const solid = (width: number, height: number, value: number, channels: 3 | 4) =>
  Buffer.alloc(width * height * channels, value);

async function product(
  over: (png: Buffer) => Promise<Buffer>,
  excluded: { x: number; y: number; w: number; h: number }[] = [],
) {
  const box = { x: 100, y: 100, w: 40, h: 40 };
  const base = await sharp(solid(400, 400, 100, 3), {
    raw: { width: 400, height: 400, channels: 3 },
  })
    .png()
    .toBuffer();
  const rgba = Buffer.alloc(40 * 40 * 4, 100);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  return productProblems(await over(base), { rgba, box }, excluded);
}

const paint = async (
  png: Buffer,
  rect: { left: number; top: number; width: number; height: number },
  value: number,
) => {
  const input = await sharp(solid(rect.width, rect.height, value, 3), {
    raw: { width: rect.width, height: rect.height, channels: 3 },
  })
    .png()
    .toBuffer();
  return sharp(png)
    .composite([{ input, left: rect.left, top: rect.top }])
    .png()
    .toBuffer();
};

const PRODUCT_CASES: Case[] = [
  {
    name: "layer 1 product: identical pixels pass",
    run: async () => same(await product(async (png) => png), []),
  },
  {
    name: "layer 1 product: a small JPEG-sized difference passes, a replaced region fails",
    run: async () =>
      same(
        [
          await product((png) =>
            paint(png, { left: 100, top: 100, width: 40, height: 40 }, 102),
          ),
          (
            await product((png) =>
              paint(png, { left: 100, top: 100, width: 40, height: 20 }, 220),
            )
          ).length,
        ],
        [[], 1],
      ),
  },
  {
    name: "layer 1 product: what is drawn over the product on purpose is left out",
    run: async () =>
      same(
        await product(
          (png) =>
            paint(png, { left: 100, top: 100, width: 40, height: 20 }, 220),
          [{ x: 90, y: 90, w: 60, h: 40 }],
        ),
        [],
      ),
  },
];

const NAME_CASES: Case[] = [
  {
    name: "file name: store, product, round and creative, with the currency only when a price shows",
    run: () =>
      same(
        [
          creativeFileName({
            store: "My Store",
            product: "Pine Jar — 12 oz",
            round: 1,
            n: 2,
            currency: "usd",
          }),
          creativeFileName({
            store: "Acme",
            product: "Pine Jar",
            round: 3,
            n: 1,
            currency: null,
          }),
          creativeFileName({
            store: null,
            product: "!!!",
            round: 1,
            n: 3,
            currency: "CAD",
          }),
        ],
        [
          "my-store-pine-jar-12-oz-r1-c2-USD.png",
          "acme-pine-jar-r3-c1.png",
          "store-product-r1-c3-CAD.png",
        ],
      ),
  },
];

// The two-line wordmark is planned with real Poppins metrics, drawn by Satori, and its drawn lines must fit the box the plan gave them.
const WORDMARK_CASES: Case[] = [
  {
    name: "render: a two-line Poppins wordmark is drawn in two lines inside its box",
    run: async () => {
      const dir = mkdtempSync(join(tmpdir(), "golden-wordmark-"));
      try {
        const fonts = await loadFonts(currentVersions(["Poppins"]), {
          storage: createLocalStorage(dir),
          http: createFontReplayHttp(FONT_FIXTURES),
        });
        const { logo } = placeLogo(
          {
            kind: "wordmark",
            aspect: 1,
            colourClass: null,
            colours: [],
            headerBackground: null,
            badge: false,
            wordmark: "Weekend Coffee Roasters Co.",
            brandInk: null,
          },
          {
            geometry: 2,
            sample: () => flatBackdrop([20, 20, 20]),
            avoid: [],
            measure: createMeasure(fonts, "Poppins"),
            fontFamily: "Poppins",
            fallback: () => false,
            unsupported: () => false,
          },
        );
        if (logo?.wordmark?.lines.length !== 2) {
          return `expected two lines, got ${JSON.stringify(logo?.wordmark?.lines)}`;
        }
        const layout = { ...LAYOUT, logo };
        const { nodes } = await renderTextLayer(layout, { fonts, logo: null });
        return same(nodeProblems(layout, nodes), []);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  },
];

export const PIXEL_CASES: Case[] = [
  ...WORDMARK_CASES,
  ...READBACK_CASES,
  ...BORDER_CASES,
  ...PRODUCT_CASES,
  ...NAME_CASES,
];
