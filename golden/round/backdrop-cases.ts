import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  backdropMask,
  chooseMask,
  type MaskChoice,
  type PhotoTier,
} from "@/lib/intake";
import { preparePhoto, productCutout } from "@/lib/round/background";
import { createLocalStorage } from "@/lib/providers/storage";
import type { Fal } from "@/lib/providers/fal";
import { same, type Case } from "./cases";
import { memoryPhotos } from "./photos";

const svg = (body: string, size = 400) =>
  sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${body}</svg>`,
    ),
  );

const WHITE = '<rect width="100%" height="100%" fill="#fff"/>';

const probes = async (mask: Buffer, points: [number, number][]) => {
  const { data, info } = await sharp(mask)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return points.map(([x, y]) =>
    (data[y * info.width + x] ?? 0) >= 128 ? 1 : 0,
  );
};

const BACKDROP_ROWS: {
  name: string;
  body: string;
  points: [number, number][];
  expected: { uniform: boolean; share: number; probes: number[] };
}[] = [
  {
    name: "a box and a card on white keep the whole set, enclosed white included",
    body: `${WHITE}<rect x="100" y="150" width="200" height="200" fill="#c23b3b"/><rect x="150" y="200" width="60" height="60" fill="#fff"/><rect x="30" y="30" width="80" height="60" fill="#2f6f5e"/>`,
    points: [
      [200, 300],
      [180, 230],
      [60, 60],
      [5, 5],
      [350, 200],
    ],
    expected: { uniform: true, share: 0.28, probes: [1, 1, 1, 0, 0] },
  },
  {
    name: "a dark gradient is not a uniform backdrop",
    body: `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#101018"/><stop offset="1" stop-color="#9a9fb8"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="100" y="150" width="200" height="200" fill="#c23b3b"/>`,
    points: [],
    expected: { uniform: false, share: 0, probes: [] },
  },
  {
    name: "specks under 0.2% of the frame are dropped",
    body: `${WHITE}<rect x="100" y="150" width="200" height="200" fill="#c23b3b"/><rect x="20" y="20" width="3" height="3" fill="#000"/>`,
    points: [
      [200, 250],
      [21, 21],
    ],
    expected: { uniform: true, share: 0.25, probes: [1, 0] },
  },
  {
    name: "a soft drop shadow stays in the foreground",
    body: `<defs><filter id="b"><feGaussianBlur stdDeviation="6"/></filter></defs>${WHITE}<ellipse cx="200" cy="330" rx="110" ry="14" fill="#000" opacity="0.4" filter="url(#b)"/><rect x="130" y="120" width="140" height="200" fill="#2f6f5e"/>`,
    points: [
      [200, 330],
      [200, 200],
      [5, 5],
    ],
    expected: { uniform: true, share: 0.21, probes: [1, 1, 0] },
  },
];

const BACKDROP_CASE: Case = {
  name: "backdrop mask: uniform border, whole foreground, enclosed holes kept, specks dropped, shadows kept",
  run: async () => {
    const actual = [];
    for (const row of BACKDROP_ROWS) {
      const found = await backdropMask(await svg(row.body).png().toBuffer());
      actual.push({
        uniform: found.uniform,
        share: Number(found.foregroundShare.toFixed(2)),
        probes: found.mask ? await probes(found.mask, row.points) : [],
      });
    }
    return same(
      actual,
      BACKDROP_ROWS.map((row) => row.expected),
    );
  },
};

type Stats = {
  modelShare: number;
  foregroundShare: number;
  containedShare: number;
  foregroundShapes: number;
};

// Measured with maskStats from the work copies and BiRefNet masks of the meaningfulcards necklace photos 1, 2, 4 and 5 (20 Nov 2026). The photos are third-party and not committed.
const P1: Stats = {
  modelShare: 0.028,
  foregroundShare: 0.885,
  containedShare: 1,
  foregroundShapes: 1,
};
const NECKLACE: [photo: number, stats: Stats][] = [
  [1, P1],
  [
    2,
    {
      modelShare: 0.026,
      foregroundShare: 0.867,
      containedShare: 1,
      foregroundShapes: 1,
    },
  ],
  [
    4,
    {
      modelShare: 0.06,
      foregroundShare: 0.735,
      containedShare: 1,
      foregroundShapes: 1,
    },
  ],
  [
    5,
    {
      modelShare: 0.01,
      foregroundShare: 0.739,
      containedShare: 1,
      foregroundShapes: 1,
    },
  ],
];

const PRODUCT: Stats = {
  modelShare: 0.3,
  foregroundShare: 0.36,
  containedShare: 1,
  foregroundShapes: 1,
};

const CHOICES: {
  name: string;
  tier?: PhotoTier;
  giftSet?: boolean;
  uniform?: boolean;
  stats: Partial<Stats>;
  expected: MaskChoice;
}[] = [
  ...NECKLACE.flatMap(([photo, stats]) =>
    [true, false].map((giftSet) => ({
      name: `necklace photo ${photo}, gift set ${giftSet}`,
      giftSet,
      stats,
      expected: "backdrop" as const,
    })),
  ),
  {
    name: "added text",
    tier: "added_text",
    giftSet: true,
    stats: P1,
    expected: "model",
  },
  {
    name: "backdrop not uniform",
    giftSet: true,
    uniform: false,
    stats: P1,
    expected: "model",
  },
  { name: "a product with a soft shadow", stats: PRODUCT, expected: "model" },
  {
    name: "foreground under the model mask",
    giftSet: true,
    stats: { ...PRODUCT, modelShare: 0.4, foregroundShare: 0.3 },
    expected: "model",
  },
  {
    name: "foreground is the frame",
    giftSet: true,
    stats: { ...P1, foregroundShare: 0.98 },
    expected: "model",
  },
  {
    name: "model mask over half the foreground",
    stats: { ...PRODUCT, modelShare: 0.4, foregroundShare: 0.6 },
    expected: "model",
  },
  {
    name: "model mask leaks out of the foreground",
    stats: { ...P1, containedShare: 0.9 },
    expected: "model",
  },
  {
    name: "two foreground shapes, not a gift set",
    stats: { ...P1, foregroundShapes: 2 },
    expected: "model",
  },
  {
    name: "two foreground shapes, a gift set",
    giftSet: true,
    stats: { ...P1, foregroundShapes: 2 },
    expected: "backdrop",
  },
  {
    name: "a gift set whose model mask is most of the set",
    giftSet: true,
    stats: { ...PRODUCT, modelShare: 0.4, foregroundShare: 0.6 },
    expected: "backdrop",
  },
];

const CHOOSE_CASE: Case = {
  name: "mask choice: the backdrop mask only for a uniform, non-text photo whose set the model mask misses, or a gift set",
  run: () =>
    same(
      CHOICES.map((row) => [
        row.name,
        chooseMask({
          tier: row.tier ?? "clean",
          giftSet: row.giftSet ?? false,
          uniform: row.uniform ?? true,
          ...PRODUCT,
          ...row.stats,
        }),
      ]),
      CHOICES.map((row) => [row.name, row.expected]),
    ),
};

const unused = () => {
  throw new Error("golden: Fal is not used by this case");
};

// A gift set on white: a box with an enclosed window, a card and a small necklace the model mask keeps alone.
const SET = `${WHITE}<rect x="150" y="250" width="200" height="130" fill="#c23b3b"/><rect x="200" y="290" width="40" height="40" fill="#fff"/><rect x="40" y="60" width="100" height="70" fill="#2f6f5e"/><circle cx="260" cy="130" r="30" fill="#c9a227"/>`;
const NECKLACE_ONLY = `<rect width="100%" height="100%" fill="#000"/><circle cx="260" cy="130" r="30" fill="#fff"/>`;

// What an edit or a check derives for a photo: the legacy box (no marker) and the recipe-1 box, again from a fresh builder over what the first one stored.
const CUTOUT_CASE: Case = {
  name: "cut-out: no marker keeps the model's box; recipe 1 takes the whole set for a gift set, is cached, and re-derives the same box",
  run: async () => {
    const dir = mkdtempSync(join(tmpdir(), "golden-backdrop-"));
    try {
      const storage = createLocalStorage(dir);
      const work = await svg(SET).jpeg({ quality: 92 }).toBuffer();
      const mask = await svg(NECKLACE_ONLY).greyscale().png().toBuffer();
      const stored = [];
      for (const id of ["set", "text"]) {
        await storage.put("photos", `fx/${id}-work.jpg`, work, "image/jpeg");
        stored.push({
          id,
          sha256: `fixture-${id}`,
          workPath: `fx/${id}-work.jpg`,
          maskPath: null,
          backdropPath: null,
          maskChoice: null,
          productBbox: null,
        });
      }
      const photos = memoryPhotos(stored);
      const fal = {
        backgroundMask: async () => mask,
        backgroundEdit: unused,
      } as Fal;
      const deps = { storage, fal, photos };
      const boxes = async (id: string, tier: PhotoTier, giftSet: boolean) => {
        const first = await preparePhoto(id, deps, { tier, giftSet });
        const legacy = (await productCutout(first)).box;
        const marked = (await productCutout(first, undefined, 1)).box;
        const again = await preparePhoto(id, deps, { tier, giftSet });
        const rederived = (await productCutout(again, undefined, 1)).box;
        const row = await photos.get(id);
        return {
          legacy,
          marked,
          rederived,
          maskChoice: row.maskChoice,
          cached: row.backdropPath !== null,
        };
      };
      return same(
        [
          await boxes("set", "clean", true),
          await boxes("text", "added_text", true),
        ],
        [
          {
            legacy: { x: 200, y: 741, w: 680, h: 669 },
            marked: { x: 200, y: 724, w: 680, h: 702 },
            rederived: { x: 200, y: 724, w: 680, h: 702 },
            maskChoice: "backdrop-1",
            cached: true,
          },
          {
            legacy: { x: 200, y: 741, w: 680, h: 669 },
            marked: { x: 200, y: 741, w: 680, h: 669 },
            rederived: { x: 200, y: 741, w: 680, h: 669 },
            maskChoice: "model-1",
            cached: false,
          },
        ],
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
};

export const BACKDROP_CASES: Case[] = [BACKDROP_CASE, CHOOSE_CASE, CUTOUT_CASE];
