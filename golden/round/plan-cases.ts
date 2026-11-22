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
import {
  allowedPhotos,
  planRequest,
  validatePlan,
  type RawPlan,
} from "@/lib/round/plan";
import type { FrozenPhoto, RoundInputs } from "@/lib/round/inputs";
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
      giftSet: false,
      backdropUniform: null,
    },
  ],
};

const GIFTS: RoundInputs = {
  ...BASE_INPUTS,
  photos: [
    {
      ...BASE_INPUTS.photos[0]!,
      id: "gift-gradient",
      giftSet: true,
      backdropUniform: false,
    },
    {
      ...BASE_INPUTS.photos[0]!,
      id: "gift-white",
      giftSet: true,
      backdropUniform: true,
    },
    {
      ...BASE_INPUTS.photos[0]!,
      id: "set-unmeasured",
      giftSet: true,
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
    name: "product placement: with room the zone starts below the badge's room and the product sits on its bottom; without it the product is centred",
    run: () =>
      same(
        [
          placeProduct(400, 1000, undefined, 1),
          placeProduct(1000, 500, undefined, 1),
          placeProduct(1000, 1000, undefined, 1),
          placeProduct(1000, 1000, "smaller", 1),
          placeProduct(400, 1000),
          placeProduct(1000, 500),
        ],
        [
          { x: 424, y: 883, w: 231, h: 577 },
          { x: 200, y: 1120, w: 680, h: 340 },
          { x: 251, y: 883, w: 577, h: 577 },
          { x: 285, y: 950, w: 510, h: 510 },
          { x: 386, y: 690, w: 308, h: 770 },
          { x: 200, y: 905, w: 680, h: 340 },
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
          { method: "tonal", reason: "scene", cutout: 1 },
          6,
          ["bria", "bria", "bria", "bria"],
          {
            method: "bria",
            prompt:
              "A sunlit light-wood table beside a window, soft morning light, warm neutral colours, calm and uncluttered.",
            reason: "flat",
            cutout: 1,
          },
          6,
          {
            backgrounds: {
              method: "bria",
              prompt: "A pine table",
              reason: "scene",
              cutout: 1,
            },
            repairs: [],
          },
        ],
      );
    },
  },
  {
    name: "plan: every candidate gets a generated background with a cut-out, whatever the photo, and smaller sets the size",
    run: () =>
      same(
        [
          planned("plain", SCENE, { productSize: "smaller" }).backgrounds[0],
          planned("scene", TONAL, {}).backgrounds[0],
          planned("scene", TONAL, { productSize: "smaller" }).backgrounds[0],
          planned("person", TONAL, {}).backgrounds[0],
          planned("set-unmeasured", TONAL, {}, GIFTS).backgrounds[0],
        ],
        [
          {
            method: "bria",
            prompt: "A pine table",
            reason: "scene",
            size: "smaller",
            cutout: 1,
          },
          { method: "tonal", reason: "flat", cutout: 1 },
          { method: "tonal", reason: "flat", size: "smaller", cutout: 1 },
          { method: "tonal", reason: "flat", cutout: 1 },
          { method: "tonal", reason: "flat", cutout: 1 },
        ],
      ),
  },
  {
    name: "plan: photos with a person or a whole gift set are used only when nothing else is selected, before the tier rule",
    run: () => {
      const [base] = BASE_INPUTS.photos as [FrozenPhoto];
      const photo = (id: string, over: Partial<FrozenPhoto>): FrozenPhoto => ({
        ...base,
        id,
        ...over,
      });
      const person = photo("person", { person: true });
      const gradient = photo("gradient", {
        giftSet: true,
        backdropUniform: false,
      });
      const ids = (photos: FrozenPhoto[]) =>
        allowedPhotos(photos).map((p) => p.id);
      return same(
        [
          ids([person, photo("product", {})]),
          ids([person, photo("other-person", { person: true })]),
          ids([gradient, photo("product", {})]),
          ids([gradient, person]),
          ids([gradient]),
          ids([person, photo("text", { tier: "added_text" })]),
          ids([photo("white", { giftSet: true, backdropUniform: true })]),
        ],
        [
          ["product"],
          ["person", "other-person"],
          ["product"],
          ["gradient", "person"],
          ["gradient"],
          ["text"],
          ["white"],
        ],
      );
    },
  },
  {
    name: "plan prompt: settings and their sentence appear only when settings differ from the defaults, and photos carry only their id",
    run: () => {
      const ask = (over: Partial<BriefSettings>) => {
        const request = planRequest(
          PEOPLE,
          briefOf(PEOPLE, { settings: settings(over) }),
        );
        const sent = JSON.parse(request.prompt) as {
          settings?: BriefSettings;
          photos: { id: string }[];
        };
        return {
          settings: sent.settings ?? null,
          note: request.system.includes("The tester's settings are given"),
          photos: sent.photos,
        };
      };
      return same(
        [ask({}), ask({ productSize: "smaller" })],
        [
          {
            settings: null,
            note: false,
            photos: [{ id: "plain" }, { id: "scene" }],
          },
          {
            settings: {
              productSize: "smaller",
              backgroundStyle: "any",
            },
            note: true,
            photos: [{ id: "plain" }, { id: "scene" }],
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
        {
          method: "photo",
          placement: 2,
          isolated: true,
          gaps: true,
          whole: true,
        },
        {
          method: "bria",
          prompt: "A table",
          reason: "r",
          size: "smaller",
          cutout: 1,
        },
        { method: "tonal", reason: "r", cutout: 1 },
        { method: "photo" },
      ];
      const older = { ...LAYOUT, keepClear: undefined };
      return same(
        [
          old.settings,
          backgrounds.map((b) => parseCreative(row(b, LAYOUT)).background),
          parseCreative(row(backgrounds[4], { ...LAYOUT, keepClear: true }))
            .layout.keepClear,
          parseCreative(row(backgrounds[4], older)).layout.keepClear,
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
          "Product smaller · Brand-colored button",
          "",
        ],
      ),
  },
];
