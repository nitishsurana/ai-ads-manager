import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createScriptedFal } from "@/lib/providers/fal";
import { createFontReplayHttp, FONT_FIXTURES } from "@/lib/providers/http";
import { createLocalStorage } from "@/lib/providers/storage";
import type { RoundInputs } from "@/lib/round/inputs";
import type { StoredPhoto } from "@/lib/round/stages";
import type { Candidate } from "@/lib/round/types";
import { memoryPhotos } from "./photos";
import { runRender } from "./run";
import { colourLogo, darkLogo, plainPhoto, scenePhoto } from "./synthetic";

const typeface = { declared: null, family: "Inter", exact: true };

export const BASE_INPUTS: RoundInputs = {
  productTitle: "Pine Jar",
  sourceUrl: "https://shop.example/products/pine-jar",
  values: {
    price: "$24.00",
    wasPrice: "$30.00",
    currency: "USD",
    rating: { value: 4.7, count: 1284 },
    brandName: "Acme",
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
    tone: [],
    audience: "",
    valuePropositions: [],
    proofPoints: [],
  },
  logo: null,
  photos: [
    {
      id: "plain",
      position: 1,
      tier: "clean",
      background: "plain",
      person: false,
    },
    {
      id: "scene",
      position: 2,
      tier: "clean",
      background: "scene",
      person: false,
    },
  ],
  facts: [{ id: "offer", text: "Free shipping over $50", kind: "offer" }],
  campaign: {},
};

type Spec = {
  photoId: "plain" | "scene";
  method: "bria" | "solid" | "tonal" | "photo";
  element: Candidate["supportingElement"];
  eyebrow?: string | null;
  headline: string;
  cta: string;
};

export const candidate = (index: number, spec: Spec): Candidate => ({
  index,
  angle: "benefit",
  photoId: spec.photoId,
  supportingElement: spec.element,
  offerFactId: spec.element === "offer" ? "offer" : null,
  background:
    spec.method === "bria"
      ? { method: "bria", prompt: "A sunlit pine table", reason: "fixture" }
      : spec.method === "photo"
        ? { method: "photo" }
        : { method: spec.method, reason: "fixture" },
  copy: {
    eyebrow: spec.eyebrow ?? null,
    headline: spec.headline,
    cta: spec.cta,
  },
  backgroundPath: null,
  product: null,
  layout: null,
  previewPath: null,
});

export const SPECS: Spec[] = [
  {
    photoId: "plain",
    method: "bria",
    element: "price",
    eyebrow: "SPRING EDIT",
    headline: "Slow mornings start with this jar",
    cta: "Shop the jar",
  },
  {
    photoId: "plain",
    method: "solid",
    element: "rating",
    headline: "Loved by 1,284 careful shoppers",
    cta: "See why",
  },
  {
    photoId: "plain",
    method: "tonal",
    element: "offer",
    eyebrow: "NEW IN",
    headline: "One small jar",
    cta: "Get yours",
  },
  {
    photoId: "scene",
    method: "photo",
    element: null,
    headline: "A quieter way to start every single day",
    cta: "Discover the whole collection",
  },
  {
    photoId: "scene",
    method: "photo",
    element: "price",
    headline: "Made for slow weekends",
    cta: "Order now",
  },
  {
    photoId: "plain",
    method: "tonal",
    element: null,
    eyebrow: "A GIFT FOR THE PEOPLE WHO ALWAYS SHOW UP FIRST",
    headline: "Wrapped, ready",
    cta: "Antidisestablishmentarianism supercalifragilistic extraordinary",
  },
];

const photoPath = (id: string) => `fx/${id}-work.jpg`;

// Runs backgrounds and the text layer on synthetic photos with the scripted Fal and the committed fonts.
export async function renderFixture(
  name: string,
  inputs: RoundInputs,
  specs: Spec[],
  logo: Buffer | null,
) {
  const dir = mkdtempSync(join(tmpdir(), "golden-render-"));
  try {
    const storage = createLocalStorage(dir);
    const stored: StoredPhoto[] = [];
    for (const [id, make] of [
      ["plain", plainPhoto],
      ["scene", scenePhoto],
    ] as const) {
      const bytes = await make();
      await storage.put("photos", photoPath(id), bytes, "image/jpeg");
      stored.push({
        id,
        sha256: `fixture-${id}`,
        workPath: photoPath(id),
        maskPath: null,
        productBbox: null,
      });
    }
    if (logo && inputs.logo?.pngPath) {
      await storage.put("logos", inputs.logo.pngPath, logo, "image/png");
    }
    const composed = await runRender(
      name,
      inputs,
      specs.map((spec, index) => candidate(index, spec)),
      {
        fal: createScriptedFal({ fault: null, slowMs: 0 }),
        http: createFontReplayHttp(FONT_FIXTURES),
        storage,
        photos: memoryPhotos(stored),
      },
    );
    const previews = await Promise.all(
      composed.map(async (c) => ({
        candidate: c,
        preview:
          (await storage.get("previews", c.previewPath ?? "")) ??
          Buffer.alloc(0),
        background:
          (await storage.get("backgrounds", c.backgroundPath ?? "")) ??
          Buffer.alloc(0),
      })),
    );
    return previews;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export { colourLogo, darkLogo };
