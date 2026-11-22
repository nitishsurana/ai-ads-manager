// Writes the committed round fixtures under golden/fixtures/round-*: the frozen inputs and brief, hand-written model outputs (recorded under the keys the stages ask for), and what each case must show.
// Run: npx tsx golden/round/fixtures.ts && npx prettier --write golden/fixtures
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BriefContent } from "@/lib/brief/schema";
import type { Ai } from "@/lib/providers/ai";
import { aiSnapshotKey } from "@/lib/providers/ai";
import type { RoundInputs } from "@/lib/round/inputs";
import type { RawCopy } from "@/lib/round/copy";
import type { RawPlan } from "@/lib/round/plan";
import { briefOf } from "./inputs";
import { runStages } from "./run";
import type { Expect } from "./assert";

const typeface = { declared: null, family: "Inter", exact: false };

const BASE: RoundInputs = {
  productTitle: "Blue Mug",
  sourceUrl: "https://shop.example/products/blue-mug",
  values: {
    price: "$18.00",
    wasPrice: null,
    currency: "USD",
    rating: { value: 4.7, count: 212 },
    brandName: "Blue Mug Co",
  },
  brandKit: {
    palette: {
      primary: "#1f4e79",
      secondary: "#f4b942",
      background: "#ffffff",
      text: "#222222",
      themeColour: null,
    },
    fonts: { heading: typeface, body: typeface },
    tone: ["warm", "simple"],
    audience: "Home cooks",
    valuePropositions: ["Hand glazed stoneware", "Dishwasher safe"],
    proofPoints: ["Made in small batches"],
  },
  logo: null,
  photos: [
    {
      id: "p1",
      position: 1,
      tier: "clean",
      background: "plain",
      person: false,
      giftSet: false,
      backdropUniform: null,
    },
  ],
  facts: [],
  campaign: {},
  orderFlow: "direct",
};

type Photo = RoundInputs["photos"][number];
const photo = (
  id: string,
  position: number,
  tier: Photo["tier"],
  background: Photo["background"] = "plain",
): Photo => ({
  id,
  position,
  tier,
  background,
  person: false,
  giftSet: false,
  backdropUniform: null,
});

const tonal = { method: "tonal", scenePrompt: null, reason: "flat colour" };
const bria = (scenePrompt: string) => ({
  method: "bria" as const,
  scenePrompt,
  reason: "a scene fits the angle",
});

type Item = [
  angle: RawPlan["candidates"][number]["angle"],
  photoId: string,
  element: RawPlan["candidates"][number]["element"],
  offerFactId?: string,
  background?: RawPlan["candidates"][number]["background"],
];

const plan = (items: Item[]): RawPlan => ({
  candidates: items.map(
    ([angle, photoId, element, offerFactId, background]) => ({
      angle,
      photoId,
      element,
      offerFactId: offerFactId ?? null,
      background: background ?? {
        method: "tonal" as const,
        scenePrompt: null,
        reason: tonal.reason,
      },
    }),
  ),
});

const c = (
  index: number,
  headline: string,
  cta = "Shop now",
  eyebrow: string | null = null,
) => ({ index, eyebrow, headline, cta });

const GOOD = [
  c(0, "Made for slow mornings"),
  c(1, "Loved by 212 happy owners"),
  c(2, "Good stoneware, fairly priced"),
  c(3, "Hand glazed, one at a time", "Get yours"),
  c(4, "See the glaze up close", "Take a look"),
  c(5, "Dishwasher safe, every day"),
];

const withCopy = (changes: Record<number, ReturnType<typeof c>>) =>
  GOOD.map((entry) => changes[entry.index] ?? entry);

type Fixture = {
  name: string;
  inputs: RoundInputs;
  brief?: Partial<BriefContent>;
  plan: RawPlan;
  copy: RawCopy;
  rewrite?: RawCopy;
  expect: Expect;
};

const LONG_OFFER = "Buy two, get a third free with code SPRING26";
const LONG_SCENE =
  "A sunlit pine kitchen counter with folded linen, a small bowl of lemons and soft morning light from a window on the left, warm neutral colours, shallow depth, calm and uncluttered, nothing else in frame, gentle shadows";

const FIXTURES: Fixture[] = [
  {
    name: "round-all-text-photos",
    inputs: {
      ...BASE,
      photos: [
        photo("p3", 3, "added_text", "scene"),
        photo("p5", 5, "added_text"),
        photo("p2", 2, "added_text"),
      ],
    },
    plan: plan([
      ["benefit", "p3", "none", undefined, bria(LONG_SCENE)],
      ["social_proof", "p5", "rating"],
      ["price", "p2", "price"],
      ["lifestyle", "p3", "price", undefined, bria("Warm kitchen counter")],
      ["feature_close_up", "p5", "rating"],
      ["benefit", "p2", "none"],
    ]),
    copy: { candidates: GOOD },
    expect: {
      note: "every photo has added text, so every creative uses the featured one (position 2)",
      photoIds: ["p2"],
    },
  },
  {
    name: "round-one-element",
    inputs: {
      ...BASE,
      values: { ...BASE.values, rating: null },
      photos: [photo("p1", 1, "clean"), photo("p2", 2, "clean_low_res")],
    },
    plan: plan([
      ["benefit", "p1", "none"],
      ["social_proof", "p1", "rating"],
      ["offer", "p2", "offer", "nope"],
      ["lifestyle", "p1", "none", undefined, bria("A wooden breakfast table")],
      ["feature_close_up", "p1", "rating"],
      ["price", "p1", "price"],
    ]),
    copy: {
      candidates: withCopy({ 1: c(1, "Hand glazed stoneware for mornings") }),
    },
    expect: {
      note: "only price is on: no rating or offer badge, and the unusable angles are replaced",
      noElements: ["rating", "offer"],
      angles: ["benefit", "feature_close_up", "lifestyle", "price"],
      photoIds: ["p1"],
    },
  },
  {
    name: "round-offer-too-long",
    inputs: {
      ...BASE,
      facts: [{ id: "f-long", text: LONG_OFFER, kind: "offer" }],
    },
    plan: plan([
      ["benefit", "p1", "none"],
      ["social_proof", "p1", "rating"],
      ["price", "p1", "price"],
      ["offer", "p1", "offer", "f-long"],
      ["lifestyle", "p1", "price"],
      ["feature_close_up", "p1", "rating"],
    ]),
    copy: {
      candidates: withCopy({ 3: c(3, "Buy two, get a third free") }),
    },
    expect: {
      note: "an offer over 40 characters can't be a badge: the offer angle stays but shows no badge",
      noElements: ["offer"],
      angles: [
        "benefit",
        "feature_close_up",
        "lifestyle",
        "offer",
        "price",
        "social_proof",
      ],
    },
  },
  {
    name: "round-three-elements",
    inputs: {
      ...BASE,
      facts: [
        { id: "f-long", text: LONG_OFFER, kind: "offer" },
        { id: "f-short", text: "Free shipping over $50", kind: "offer" },
      ],
      campaign: { occasion: "Spring refresh" },
    },
    brief: {
      rules: [
        {
          id: "r1",
          kind: "do",
          text: "Keep it airy and bright",
          source: "chat",
          locked: false,
        },
      ],
      approvedAngles: ["benefit", "lifestyle"],
    },
    plan: plan([
      ["benefit", "p1", "none"],
      ["social_proof", "p1", "rating"],
      ["price", "p1", "price"],
      ["offer", "p1", "offer", "f-long"],
      ["lifestyle", "p1", "offer", "f-long"],
      ["feature_close_up", "p1", "rating"],
    ]),
    copy: {
      candidates: withCopy({
        0: c(0, "Made for slow mornings", "Shop now", "Spring refresh"),
        3: c(3, "Free shipping over $50"),
      }),
    },
    expect: {
      note: "price, rating and a short offer are on: each shows on two candidates, and the offer badge uses the short offer, not the long one",
      offerFactId: "f-short",
      eyebrows: { "0": "SPRING REFRESH" },
    },
  },
  {
    name: "round-copy-rewrite",
    inputs: BASE,
    plan: plan([
      ["benefit", "p1", "none"],
      ["social_proof", "p1", "rating"],
      ["price", "p1", "price"],
      ["lifestyle", "p1", "price"],
      ["feature_close_up", "p1", "rating"],
      ["benefit", "p1", "none"],
    ]),
    copy: {
      candidates: withCopy({
        0: c(0, "A mug that makes every single morning better"),
        1: c(1, "Loved by 212 happy owners", "Order yours today right now"),
        2: c(2, "Save 50% on your first mug"),
        3: c(3, "Hand glazed, one at a time", "Get yours", "SUMMER SALE"),
      }).filter((entry) => entry.index !== 4),
    },
    rewrite: {
      candidates: [
        c(0, "Better mornings start here"),
        c(1, "Loved by 212 happy owners", "Order yours"),
        c(2, "A fair price for real stoneware"),
        c(4, "See the glaze up close", "Take a look"),
      ],
    },
    expect: {
      note: "three drafts break the limits or invent a discount and pass after one rewrite; a candidate missing from the first answer joins that rewrite; an eyebrow with no campaign is dropped without a rewrite",
      dropped: [],
      headlines: {
        "0": "Better mornings start here",
        "2": "A fair price for real stoneware",
        "4": "See the glaze up close",
      },
      eyebrows: { "3": null },
    },
  },
  {
    name: "round-copy-dropped",
    inputs: { ...BASE, campaign: { occasion: "Diwali" } },
    plan: plan([
      ["benefit", "p1", "none"],
      ["social_proof", "p1", "rating"],
      ["price", "p1", "price"],
      ["lifestyle", "p1", "price"],
      ["feature_close_up", "p1", "rating"],
      ["benefit", "p1", "none"],
    ]),
    copy: {
      candidates: withCopy({
        0: c(0, "Made for slow mornings", "Shop now", "Diwali gifting"),
        1: c(1, "A mug that makes every single morning of your life better"),
        2: c(
          2,
          "Stoneware glazed by hand",
          "Get yours",
          "DIWALI GIFTING SEASON SPECIAL OFFER",
        ),
        4: c(4, ""),
      }),
    },
    rewrite: {
      candidates: [
        c(1, "A mug that makes every single morning better"),
        c(4, "The #1 mug for tea"),
      ],
    },
    expect: {
      note: "a draft still over the limit after the rewrite and one that invents a claim are dropped; an eyebrow that pushes past 8 words is dropped instead",
      dropped: [1, 4],
      eyebrows: { "0": "DIWALI GIFTING", "2": null },
      elements: { "0": "rating", "5": "rating" },
    },
  },
  {
    name: "round-claims",
    inputs: {
      ...BASE,
      values: { ...BASE.values, rating: { value: 4.9, count: 28 } },
      brandKit: {
        ...BASE.brandKit,
        valuePropositions: ["Hand glazed stoneware", "Lead-free glaze"],
      },
      campaign: { occasion: "Spring sale" },
    },
    plan: plan([
      ["benefit", "p1", "none"],
      ["social_proof", "p1", "rating"],
      ["price", "p1", "price"],
      ["lifestyle", "p1", "price"],
      ["feature_close_up", "p1", "rating"],
      ["benefit", "p1", "none"],
    ]),
    copy: {
      candidates: withCopy({
        0: c(0, "The finest mug, limited time only"),
        1: c(1, "Free returns on every order"),
        2: c(2, "Thousands of reviews, one great mug"),
        3: c(3, "Hand glazed, one at a time", "Get yours", "Spring sale"),
        5: c(5, "See the glaze up close"),
      }),
    },
    rewrite: {
      candidates: [
        c(0, "A calmer start to the day"),
        c(1, "Lead-free glaze, hand finished"),
        c(2, "Rated 4.9 from 28 reviews"),
        c(5, "Dishwasher safe, every day"),
      ],
    },
    expect: {
      note: "digit-less urgency and superlatives, 'Free returns' next to a 'lead-free' fact, and 'thousands' on a 28-review rating all fail and pass after the rewrite; an eyebrow with an unconfirmed 'sale' is dropped; a repeated headline is rewritten",
      dropped: [],
      headlines: {
        "0": "A calmer start to the day",
        "1": "Lead-free glaze, hand finished",
        "2": "Rated 4.9 from 28 reviews",
        "5": "Dishwasher safe, every day",
      },
      eyebrows: { "3": null },
    },
  },
  {
    name: "round-person-skipped",
    inputs: {
      ...BASE,
      photos: [
        photo("p1", 1, "clean"),
        photo("p2", 2, "clean", "scene"),
        { ...photo("p3", 3, "clean"), person: true },
      ],
    },
    plan: plan([
      ["benefit", "p1", "none", undefined, bria("A pale oak shelf")],
      ["social_proof", "p2", "rating", undefined, bria("A sunlit table")],
      ["price", "p1", "price", undefined, bria("A kitchen counter")],
      ["lifestyle", "p1", "price", undefined, bria("A window sill")],
      ["feature_close_up", "p2", "rating", undefined, bria("A grey stone")],
      ["benefit", "p2", "none", undefined, bria("A linen cloth")],
    ]),
    copy: { candidates: GOOD },
    expect: {
      note: "a photo with a person is skipped while a product-only photo is selected, and a scene photo is cut out and given a new background",
      photoIds: ["p1", "p2"],
    },
  },
  {
    name: "round-person-only",
    inputs: {
      ...BASE,
      photos: [
        { ...photo("p1", 1, "clean"), person: true },
        { ...photo("p2", 2, "clean", "scene"), person: true },
      ],
    },
    plan: plan([
      ["benefit", "p1", "none", undefined, bria("A pale oak shelf")],
      ["social_proof", "p2", "rating", undefined, bria("A sunlit table")],
      ["price", "p1", "price", undefined, bria("A kitchen counter")],
      ["lifestyle", "p2", "price", undefined, bria("A window sill")],
      ["feature_close_up", "p1", "rating", undefined, bria("A grey stone")],
      ["benefit", "p2", "none", undefined, bria("A linen cloth")],
    ]),
    copy: { candidates: GOOD },
    expect: {
      note: "when every selected photo has a person they are all used, cut out with the person and given a new background",
      photoIds: ["p1", "p2"],
    },
  },
];

function recorder(fixture: Fixture, log: Record<string, unknown>): Ai {
  const queue: Record<string, unknown[]> = {
    art_direction: [fixture.plan],
    copy: [fixture.copy],
    copy_rewrite: fixture.rewrite ? [fixture.rewrite] : [],
  };
  return {
    async generate(request) {
      const next = queue[request.task]?.shift();
      if (next === undefined) {
        throw new Error(
          `${fixture.name}: no output written for ${request.task}`,
        );
      }
      log[aiSnapshotKey(request)] = next;
      return { object: request.schema.parse(next), costUsd: null };
    },
  };
}

async function main() {
  for (const fixture of FIXTURES) {
    const dir = join("golden", "fixtures", fixture.name);
    const log: Record<string, unknown> = {};
    const brief = briefOf(fixture.inputs, fixture.brief);
    await runStages(
      fixture.name,
      fixture.inputs,
      brief,
      recorder(fixture, log),
    );
    mkdirSync(dir, { recursive: true });
    const write = (file: string, data: unknown) =>
      writeFileSync(join(dir, file), `${JSON.stringify(data, null, 2)}\n`);
    write("inputs.json", { inputs: fixture.inputs, brief });
    write("ai.json", log);
    write("expect.json", fixture.expect);
    console.log(`wrote ${dir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
