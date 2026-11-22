import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { currentVersions, loadFonts } from "@/lib/render";
import { createFontReplayHttp, FONT_FIXTURES } from "@/lib/providers/http";
import { createLocalStorage } from "@/lib/providers/storage";
import { planCreative, readLogo } from "@/lib/round/compose";
import { same, type Case } from "./cases";
import { BASE_INPUTS, candidate, renderFixture, SPECS } from "./render-cases";
import { LOGO_FIXTURE } from "./render-run";
import { darkLogo } from "./synthetic";

const INPUTS = { ...BASE_INPUTS, logo: LOGO_FIXTURE };

const PRODUCT = { x: 424, y: 883, w: 231, h: 577 };

// An edit re-plans from the stored background with the stored layout's values: the logo geometry, the badge and logo rules, the button colour and its mode.
async function replan(
  headline: string,
  stored: {
    logoGeometry?: 1 | 2;
    badgeRule?: 1 | 2;
    ctaPreferred?: string;
  },
) {
  const dir = mkdtempSync(join(tmpdir(), "golden-edit-"));
  try {
    const fonts = await loadFonts(currentVersions(["Inter"]), {
      storage: createLocalStorage(dir),
      http: createFontReplayHttp(FONT_FIXTURES),
    });
    const background = await sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 3,
        background: "#c9a27a",
      },
    })
      .png()
      .toBuffer();
    const spec = { ...SPECS[2], headline } as (typeof SPECS)[number];
    const layout = await planCreative(
      { ...candidate(0, spec), product: PRODUCT },
      background,
      {
        inputs: INPUTS,
        fonts,
        logo: await readLogo(await darkLogo(), { width: null, height: null }),
        label: "edit case",
        ...stored,
      },
    );
    return {
      logoGeometry: layout.logoGeometry,
      badge: layout.badge?.box,
      badgeRule: layout.badgeRule,
      logo: layout.logo?.box,
      cta: { background: layout.cta.background, mode: layout.cta.mode },
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const EDIT_CASES: Case[] = [
  {
    name: "edit: a creative stored before the larger logo and the badge rule re-plans with the earlier logo box and badge placement, and keeps its button colour",
    run: async () =>
      same(
        await replan("One small jar", {
          logoGeometry: 1,
          badgeRule: 1,
          ctaPreferred: "#961e3c",
        }),
        {
          badge: { x: 296, y: 907, w: 383, h: 158 },
          logo: { x: 821, y: 1661, w: 194, h: 67 },
          cta: { background: "#961e3c", mode: "auto" },
        },
      ),
  },
  {
    name: "edit: a creative planned with the larger logo and the badge rule keeps its markers and button colour through a text edit, and a stored colour within ΔE 20 of a brand colour is re-picked",
    run: async () => {
      const first = await replan("One small jar", {});
      const kept = await replan("Two small jars", {
        logoGeometry: 2,
        badgeRule: 2,
        ctaPreferred: first.cta.background,
      });
      const rejected = await replan("Two small jars", {
        logoGeometry: 2,
        badgeRule: 2,
        ctaPreferred: "#1f4e79",
      });
      const planned = {
        logoGeometry: 2,
        badge: { x: 272, y: 701, w: 383, h: 158 },
        badgeRule: 2,
        logo: { x: 773, y: 1734, w: 259, h: 90 },
        cta: { background: "#bd7c0f", mode: "auto" },
      };
      return same([first, kept, rejected], [planned, planned, planned]);
    },
  },
  {
    name: "edit: every new cut-out, badge or not, is stored with room and keeps its box below the badge's room, and a Bria scene stored with a grade passes Layer 1 as it is re-checked",
    run: async () => {
      const rendered = await renderFixture(
        "edit-stored",
        BASE_INPUTS,
        [SPECS[0], SPECS[7], { ...SPECS[2], element: "price" }] as typeof SPECS,
        null,
      );
      return same(
        rendered.map(({ candidate: { background, product }, placement }) => ({
          room: "room" in background ? background.room : undefined,
          grade: "grade" in background ? background.grade : undefined,
          product,
          placement,
        })),
        [
          {
            room: 1,
            grade: [1, 1, 1],
            product: { x: 312, y: 883, w: 455, h: 577 },
            placement: [],
          },
          {
            room: 1,
            product: { x: 312, y: 883, w: 455, h: 577 },
            placement: [],
          },
          {
            room: 1,
            product: { x: 312, y: 883, w: 455, h: 577 },
            placement: [],
          },
        ],
      );
    },
  },
];
