import { cleanLogo } from "@/lib/intake/brand/clean";
import type { LoadedLogo } from "@/lib/intake/brand/load";
import { same, type Case } from "./round/cases";

// A 200 x 60 logo on transparency, mostly empty so it is not a badge: a grey block, a green one and a pale trim, side by side, and one grey pixel that stretches its box.
const raster = () => {
  const [width, height] = [200, 60];
  const data = Buffer.alloc(width * height * 4);
  const blocks: [number, number, number, number, number][] = [
    [0, 100, 67, 73, 69],
    [100, 150, 68, 213, 127],
    [150, 170, 244, 244, 246],
  ];
  for (const [from, to, r, g, b] of blocks) {
    for (let y = 0; y < 25; y++) {
      for (let x = from; x < to; x++)
        data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  data.set([67, 73, 69, 255], 59 * width * 4);
  return { data, width, height };
};

const loaded = (svgColours: string[] | null): LoadedLogo => ({
  sha256: "fixture",
  sourceUrl: null,
  alt: null,
  raster: raster(),
  svgClass: svgColours && { colourClass: "multi_colour", colours: svgColours },
  transparentSource: true,
});

const read = async (svgColours: string[] | null) => {
  const cleaned = await cleanLogo(loaded(svgColours));
  return {
    colours: cleaned?.colours,
    shares: cleaned?.shares.map((share) => Math.round(share * 100) / 100),
  };
};

export const BRAND_CASES: Case[] = [
  {
    name: "logo shares: a raster logo takes the shares of its clusters; an svg's fills in markup order are sorted by share, unreadable ones are dropped and a colour with no cluster gets 0",
    run: async () =>
      same(
        [
          await read(null),
          await read([
            "#f4f4f6",
            "not-a-colour",
            "#434945",
            "#d00c0d",
            "#44d57f",
          ]),
        ],
        [
          {
            colours: ["#434945", "#44d57f", "#f4f4f6"],
            shares: [0.6, 0.29, 0.11],
          },
          {
            colours: ["#434945", "#44d57f", "#f4f4f6", "#d00c0d"],
            shares: [0.6, 0.29, 0.11, 0],
          },
        ],
      ),
  },
];
