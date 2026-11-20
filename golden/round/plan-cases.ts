import {
  briefContentSchema,
  cleanNotApplied,
  DEFAULT_SETTINGS,
  rewriteSettingsSchema,
} from "@/lib/brief/schema";
import { notAppliedText, settingsText } from "@/lib/brief/settings-line";
import type { BriefSettings } from "@/lib/brief/schema";
import { placeProduct, productLimit } from "@/lib/round/background/placement";
import { parseCreative } from "@/lib/round/creative";
import type { RoundCreative } from "@/lib/db/queries";
import { planRequest, validatePlan, type RawPlan } from "@/lib/round/plan";
import type { RoundInputs } from "@/lib/round/inputs";
import { same, type Case } from "./cases";
import { briefOf } from "./inputs";
import { LAYOUT } from "./layout-fixture";
import { BASE_INPUTS } from "./render-cases";

const PEOPLE: RoundInputs = {
  ...BASE_INPUTS,
  photos: [
    ...BASE_INPUTS.photos,
    {
      id: "person",
      position: 3,
      tier: "clean",
      background: "plain",
      person: true,
    },
  ],
};

const raw = (
  photoId: string,
  background: RawPlan["candidates"][number]["background"],
): RawPlan => ({
  candidates: (
    [
      "benefit",
      "social_proof",
      "price",
      "offer",
      "lifestyle",
      "feature_close_up",
    ] as const
  ).map((angle) => ({
    angle,
    photoId,
    element: "none",
    offerFactId: null,
    background,
  })),
});

const TONAL = { method: "tonal", scenePrompt: null, reason: "flat" } as const;
const SCENE = {
  method: "bria",
  scenePrompt: "A pine table",
  reason: "scene",
} as const;

const settings = (over: Partial<BriefSettings>): BriefSettings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

// What the first candidate gets, and the repairs the plan recorded.
const planned = (
  photoId: string,
  background: RawPlan["candidates"][number]["background"],
  over: Partial<BriefSettings>,
  inputs = PEOPLE,
) => {
  const { candidates, repairs } = validatePlan(
    raw(photoId, background),
    inputs,
    [],
    settings(over),
  );
  return {
    backgrounds: candidates.map((c) => c.background),
    repairs: repairs.filter((r) => r.endsWith("background")),
  };
};

const row = (background: unknown, layout: unknown) =>
  ({
    angle: "benefit",
    background,
    copy: { eyebrow: null, headline: "h", cta: "c" },
    layout,
    edits: [],
  }) as unknown as RoundCreative;

export const PLAN_CASES: Case[] = [
  {
    name: "product size: smaller is 0.75 of the normal limit and shrinks the placed product",
    run: () =>
      same(
        [
          productLimit(),
          productLimit("smaller"),
          placeProduct(1000, 1000),
          placeProduct(1000, 1000, "smaller"),
        ],
        [
          { w: 680, h: 770 },
          { w: 510, h: 577.5 },
          { x: 200, y: 735, w: 680, h: 680 },
          { x: 285, y: 820, w: 510, h: 510 },
        ],
      ),
  },
  {
    name: "plan: background style plain turns scenes into tonal and scene fills the gaps, each recorded as a repair",
    run: () => {
      const [first] = planned("plain", SCENE, {
        backgroundStyle: "plain",
      }).backgrounds;
      const scene = planned("plain", TONAL, { backgroundStyle: "scene" });
      return same(
        [
          first,
          planned("plain", SCENE, { backgroundStyle: "plain" }).repairs.length,
          scene.backgrounds.slice(0, 4).map((b) => b.method),
          scene.backgrounds[0],
          scene.repairs.length,
          planned("plain", SCENE, { backgroundStyle: "scene" }),
        ].map((value) =>
          typeof value === "object" && value && "backgrounds" in value
            ? { backgrounds: value.backgrounds[0], repairs: value.repairs }
            : value,
        ),
        [
          { method: "tonal", reason: "scene" },
          6,
          ["bria", "bria", "bria", "bria"],
          {
            method: "bria",
            prompt:
              "A sunlit light-wood table beside a window, soft morning light, warm neutral colours, calm and uncluttered.",
            reason: "flat",
          },
          6,
          {
            backgrounds: {
              method: "bria",
              prompt: "A pine table",
              reason: "scene",
            },
            repairs: [],
          },
        ],
      );
    },
  },
  {
    name: "plan: smaller sets the size on cut-outs only, and prefer-cut-out skips photos with a person",
    run: () =>
      same(
        [
          planned("plain", SCENE, { productSize: "smaller" }).backgrounds[0],
          planned("scene", TONAL, {}).backgrounds[0],
          planned("scene", TONAL, { productSize: "smaller" }).backgrounds[0],
          planned("scene", TONAL, { preferCutout: true }).backgrounds[0],
          planned("person", TONAL, { preferCutout: true }).backgrounds[0],
        ],
        [
          {
            method: "bria",
            prompt: "A pine table",
            reason: "scene",
            size: "smaller",
          },
          { method: "photo", placement: 2 },
          { method: "photo", placement: 2 },
          { method: "tonal", reason: "flat" },
          { method: "photo", placement: 2 },
        ],
      ),
  },
  {
    name: "plan prompt: settings, their sentence and the cut-out treatment appear only when settings differ from the defaults",
    run: () => {
      const ask = (over: Partial<BriefSettings>) => {
        const request = planRequest(
          PEOPLE,
          briefOf(PEOPLE, { settings: settings(over) }),
        );
        const sent = JSON.parse(request.prompt) as {
          settings?: BriefSettings;
          photos: { id: string; treatment: string }[];
        };
        return {
          settings: sent.settings ?? null,
          note: request.system.includes("The tester's settings are given"),
          treatments: sent.photos.map((photo) => photo.treatment),
        };
      };
      return same(
        [ask({}), ask({ preferCutout: true })],
        [
          {
            settings: null,
            note: false,
            treatments: ["cut_out", "whole_photo", "whole_photo"],
          },
          {
            settings: {
              productSize: "normal",
              preferCutout: true,
              backgroundStyle: "any",
            },
            note: true,
            treatments: ["cut_out", "cut_out", "whole_photo"],
          },
        ],
      );
    },
  },
  {
    name: "brief: settings default for an old brief, and a creative keeps its placement fields through parseCreative",
    run: () => {
      const old = briefContentSchema.parse({
        rules: [],
        campaign: {},
        research: [],
        values: BASE_INPUTS.values,
        exemplarCreativeIds: [],
        approvedAngles: [],
      });
      const backgrounds = [
        { method: "photo", placement: 2, isolated: true, gaps: true },
        { method: "bria", prompt: "A table", reason: "r", size: "smaller" },
        { method: "photo" },
      ];
      const older = { ...LAYOUT, keepClear: undefined };
      return same(
        [
          old.settings,
          backgrounds.map((b) => parseCreative(row(b, LAYOUT)).background),
          parseCreative(row(backgrounds[2], { ...LAYOUT, keepClear: true }))
            .layout.keepClear,
          parseCreative(row(backgrounds[2], older)).layout.keepClear,
        ],
        [DEFAULT_SETTINGS, backgrounds, true, false],
      );
    },
  },
  {
    name: "brief: a button colour change alone leaves the planner request byte-identical and is still not a default setting",
    run: () => {
      const ask = (over: Partial<BriefSettings>) => {
        const brief = briefOf(BASE_INPUTS, { settings: settings(over) });
        const { inputSha256, system } = planRequest(BASE_INPUTS, brief);
        return { inputSha256, system };
      };
      return same([ask({ ctaColour: "brand" })], [ask({})]);
    },
  },
  {
    name: "brief: the rewrite's settings must carry the button colour, and an old brief reads auto and no unapplied notes",
    run: () => {
      const { ctaColour, ...without } = DEFAULT_SETTINGS;
      const old = briefContentSchema.parse({
        rules: [],
        campaign: {},
        research: [],
        values: BASE_INPUTS.values,
        exemplarCreativeIds: [],
        approvedAngles: [],
        settings: without,
      });
      return same(
        [
          rewriteSettingsSchema.safeParse(without).success,
          rewriteSettingsSchema.safeParse({ ...without, ctaColour }).success,
          [old.settings.ctaColour, old.notApplied],
        ],
        [false, true, ["auto", []]],
      );
    },
  },
  {
    name: "brief: unapplied notes are trimmed, cut to 100 characters, stripped of blanks and kept to five; the panel lines name them and the button setting",
    run: () =>
      same(
        [
          cleanNotApplied([
            "  CTA higher  ",
            "",
            "   ",
            "x".repeat(150),
            "a",
            "b",
            "c",
            "d",
          ]),
          notAppliedText(["CTA higher", "Bigger logo"]),
          notAppliedText([]),
          settingsText(
            settings({ ctaColour: "brand", productSize: "smaller" }),
          ),
          settingsText(DEFAULT_SETTINGS),
        ],
        [
          ["CTA higher", "x".repeat(100), "a", "b", "c"],
          "Noted, not adjustable yet: CTA higher · Bigger logo",
          "",
          "Product smaller · Brand-coloured button",
          "",
        ],
      ),
  },
];
