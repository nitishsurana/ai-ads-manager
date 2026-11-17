// Writes the committed photo fixtures under golden/fixtures/photos-*. The HEIC photo needs macOS (sips).
// Run: npx tsx golden/photo-fixtures.ts
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { ESCALATION_MODEL, PRIMARY_MODEL } from "@/lib/intake/photos/check";
import { MODEL_COPY_VERSION } from "@/lib/intake/photos/copies";
import {
  PHOTO_CHECK_PROMPT,
  PHOTO_CHECK_SYSTEM,
} from "@/lib/intake/photos/prompts";
import { aiSnapshotKey } from "@/lib/providers/ai";
import { sha256 } from "@/lib/providers/snapshot";

const HOST = "https://cdn.shopify.com/s/files/1/0001";
const PRODUCT_URL = "https://shop.example/products/blue-mug";
const PAGE =
  '<html><head><title>Blue Mug</title></head><body><main><div id="shopify-section-template--1__main" class="shopify-section"><h1>Blue Mug</h1><div class="price"><span class="price-item">$18.00</span></div><form action="/cart/add" method="post"><input type="hidden" name="id" value="4455"><button type="submit" name="add">Add to cart</button></form></div></main></body></html>';

type Checks = {
  added_text: boolean;
  background: "plain" | "scene";
  person: boolean;
  has_product: boolean;
  product_count: number;
  text_overlaps_product: boolean;
  product_cropped_by_frame: boolean;
  confidence: "low" | "medium" | "high";
};

const clean: Checks = {
  added_text: false,
  background: "plain",
  person: false,
  has_product: true,
  product_count: 1,
  text_overlaps_product: false,
  product_cropped_by_frame: false,
  confidence: "high",
};
const withText = (over: Partial<Checks> = {}): Checks => ({
  ...clean,
  added_text: true,
  ...over,
});

type Photo = {
  file: string;
  bytes: Buffer;
  // Recorded model answers by task; mask is the Fal answer.
  // A recorded failure replays as a thrown error.
  checks?: Checks | { error: string };
  escalated?: Checks | { error: string };
  // The larger model's answer for a text photo; defaults to the primary answer.
  text?: Checks | { error: string };
  mask?: Buffer | { error: string };
  response?: { status: number; truncated?: boolean };
  host?: string;
};

async function picture(colour: string, size = 800) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#fff"/><rect x="200" y="200" width="400" height="400" fill="${colour}"/><circle cx="400" cy="400" r="100" fill="#fff"/></svg>`;
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

// Two colourways of one product: same size, a small coloured part that differs. The dot is 30px: mean difference about 0.2 (under the same-size limit) but a worst cell near 25, so only the cell limit keeps colourways apart.
async function colourway(colour: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#fff"/><circle cx="400" cy="400" r="15" fill="${colour}"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function blobs(
  shapes: { x: number; y: number; w: number; h: number; hole?: number }[],
) {
  const rects = shapes.flatMap((s) => [
    `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="#fff"/>`,
    ...(s.hole
      ? [
          `<rect x="${s.x + (s.w - s.hole) / 2}" y="${s.y + (s.h - s.hole) / 2}" width="${s.hole}" height="${s.hole}" fill="#000"/>`,
        ]
      : []),
  ]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#000"/>${rects.join("")}</svg>`;
  return sharp(Buffer.from(svg)).greyscale().png().toBuffer();
}

function json(path: string, data: unknown) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function writeFixture(name: string, photos: Photo[]) {
  const dir = join("golden", "fixtures", name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "bodies"), { recursive: true });
  const body = (data: Buffer | string) => {
    const bytes = Buffer.from(data);
    const ref = `bodies/${sha256(bytes)}`;
    writeFileSync(join(dir, ref), bytes);
    return ref;
  };

  const productJson = {
    product: {
      id: 1,
      title: "Blue Mug",
      handle: "blue-mug",
      images: photos.map((p, i) => ({
        id: i + 1,
        position: i + 1,
        src: `${p.host ?? HOST}/${p.file}`,
        width: 800,
        height: 800,
      })),
      variants: [
        {
          id: 4455,
          title: "Small",
          price: "18.00",
          compare_at_price: null,
          option1: "Small",
          option2: null,
          option3: null,
        },
      ],
      options: [{ id: 1, name: "Size", position: 1, values: ["Small"] }],
    },
  };
  const html = {
    "content-type": "text/html; charset=utf-8",
    "powered-by": "Shopify",
  };
  const http: Record<string, unknown> = {
    [`GET ${PRODUCT_URL}`]: {
      status: 200,
      headers: html,
      location: null,
      body: body("<html><title>Blue Mug</title></html>"),
    },
    [`GET ${PRODUCT_URL}.json`]: {
      status: 200,
      headers: { "content-type": "application/json" },
      location: null,
      body: body(JSON.stringify(productJson)),
    },
  };
  const ai: Record<string, unknown> = {};
  const fal: Record<string, string | { error: string }> = {};
  const dns: Record<string, string[]> = {
    "shop.example": ["93.184.216.34"],
    "cdn.shopify.com": ["23.227.38.65"],
  };

  for (const p of photos) {
    const url = `${p.host ?? HOST}/${p.file}`;
    const status = p.response?.status ?? 200;
    http[`GET ${url}`] = {
      status,
      headers: { "content-type": "image/png" },
      location: null,
      body: status === 200 ? body(p.bytes) : null,
      ...(p.response?.truncated && { truncated: true }),
    };
    const sha = sha256(p.bytes);
    const key = (task: string, model: string) =>
      aiSnapshotKey({
        task,
        model,
        system: PHOTO_CHECK_SYSTEM,
        prompt: PHOTO_CHECK_PROMPT,
        inputVersion: MODEL_COPY_VERSION,
        inputSha256: sha,
      });
    if (p.checks) ai[key("photo_check", PRIMARY_MODEL)] = p.checks;
    // A photo the primary model flags with added text is checked again by the larger model, whose answer decides.
    if (p.checks && "added_text" in p.checks && p.checks.added_text) {
      ai[key("photo_check_text", ESCALATION_MODEL)] = p.text ?? p.checks;
    }
    if (p.escalated) {
      ai[key("photo_check_escalated", ESCALATION_MODEL)] = p.escalated;
    }
    if (p.mask) fal[sha] = Buffer.isBuffer(p.mask) ? body(p.mask) : p.mask;
    if (p.host) dns[new URL(p.host).hostname] = ["10.0.0.5"];
  }

  json(join(dir, "case.json"), { url: PRODUCT_URL, location: "US" });
  json(join(dir, "dns.json"), dns);
  json(join(dir, "http.json"), http);
  json(join(dir, "firecrawl.json"), {
    [PRODUCT_URL]: { status: 200, html: body(PAGE), location: "US" },
  });
  if (Object.keys(ai).length > 0) json(join(dir, "ai.json"), ai);
  if (Object.keys(fal).length > 0) json(join(dir, "fal.json"), fal);
}

async function heic() {
  const tmp = mkdtempSync(join(tmpdir(), "heic-"));
  writeFileSync(join(tmp, "in.png"), await picture("#7a3bc2"));
  execFileSync(
    "sips",
    [
      "-s",
      "format",
      "heic",
      join(tmp, "in.png"),
      "--out",
      join(tmp, "out.heic"),
    ],
    { stdio: "ignore" },
  );
  const bytes = readFileSync(join(tmp, "out.heic"));
  rmSync(tmp, { recursive: true, force: true });
  return bytes;
}

async function main() {
  const blue = await picture("#3b6ea5");
  const red = await picture("#c23b3b");
  const green = await picture("#3bc27a");

  writeFixture("photos-duplicates", [
    { file: "blue.png", bytes: blue, checks: clean },
    { file: "blue-copy.png", bytes: blue },
    { file: "blue-small.png", bytes: await picture("#3b6ea5", 400) },
    { file: "red.png", bytes: red, checks: clean },
    { file: "red-small.png", bytes: await picture("#c23b3b", 400) },
    { file: "green.png", bytes: green, checks: clean },
  ]);

  writeFixture("photos-colourways", [
    { file: "olive.png", bytes: await colourway("#6b7a3a"), checks: clean },
    { file: "plum.png", bytes: await colourway("#7a3a5b"), checks: clean },
    { file: "olive-reexport.png", bytes: await colourway("#6b7a3b") },
  ]);

  // Haiku flags text on three photos. Sonnet counts two products on one and its answer decides; its call fails on another and Haiku's answer stands; it finds no text on the last, which is then clean (low-res by size).
  writeFixture("photos-text-disagreement", [
    { file: "clean.png", bytes: blue, checks: clean },
    {
      file: "text.png",
      bytes: red,
      checks: withText(),
      text: withText({ product_count: 2 }),
    },
    {
      file: "text-call-fails.png",
      bytes: green,
      checks: withText(),
      text: { error: "timeout" },
      mask: await blobs([{ x: 40, y: 40, w: 160, h: 160 }]),
    },
    {
      file: "no-text.png",
      bytes: await picture("#c2a13b", 600),
      checks: withText(),
      text: clean,
    },
  ]);

  const flat = (colour: string) =>
    sharp({
      create: { width: 800, height: 800, channels: 3, background: colour },
    })
      .png()
      .toBuffer();
  writeFixture("photos-drop-rules", [
    { file: "product.png", bytes: await flat("#eeeeee"), checks: clean },
    {
      file: "text-card.png",
      bytes: await flat("#222222"),
      checks: withText({ has_product: false, product_count: 0 }),
    },
    {
      file: "text-card-scene.png",
      bytes: await flat("#334455"),
      checks: withText({
        background: "scene",
        has_product: false,
        product_count: 0,
      }),
    },
    {
      file: "two-products.png",
      bytes: await flat("#445566"),
      checks: withText({ product_count: 2 }),
    },
    {
      file: "text-over-product.png",
      bytes: await flat("#556677"),
      checks: withText({ text_overlaps_product: true }),
    },
    {
      file: "cropped.png",
      bytes: await flat("#667788"),
      checks: withText({ product_cropped_by_frame: true }),
    },
    {
      file: "mask-two-shapes.png",
      bytes: await flat("#778899"),
      checks: withText(),
      mask: await blobs([
        { x: 20, y: 60, w: 80, h: 80 },
        { x: 150, y: 150, w: 80, h: 80 },
      ]),
    },
    {
      file: "mask-one-shape.png",
      bytes: await flat("#8899aa"),
      checks: withText(),
      mask: await blobs([{ x: 40, y: 40, w: 160, h: 160, hole: 60 }]),
    },
  ]);

  writeFixture("photos-low-res", [
    { file: "small.png", bytes: await picture("#3b6ea5", 799), checks: clean },
    {
      file: "boundary.png",
      bytes: await picture("#c23b3b", 800),
      checks: clean,
    },
  ]);

  writeFixture("photos-heic", [
    { file: "photo.heic", bytes: await heic(), checks: clean },
  ]);

  writeFixture("photos-all-dropped", [
    {
      file: "card.png",
      bytes: await flat("#222222"),
      checks: withText({ has_product: false, product_count: 0 }),
    },
  ]);

  writeFixture("photos-low-confidence", [
    {
      file: "unsure.png",
      bytes: await picture("#3bc27a"),
      checks: { ...clean, confidence: "low" },
      escalated: { ...withText({ background: "scene" }), confidence: "high" },
    },
  ]);

  const refusal = { error: "refusal" };
  writeFixture("photos-check-failed", [
    { file: "ok.png", bytes: blue, checks: clean },
    { file: "both-fail.png", bytes: red, checks: refusal, escalated: refusal },
    {
      file: "haiku-fails.png",
      bytes: green,
      checks: refusal,
      escalated: { ...clean, confidence: "high" },
    },
    {
      file: "mask-fails.png",
      bytes: await flat("#8899aa"),
      checks: withText(),
      mask: { error: "queue timeout" },
    },
  ]);

  // A photo-like picture re-encoded as a half-size JPEG at quality 80 must still merge.
  const scene = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4efe6"/><stop offset="1" stop-color="#b9c7d6"/></linearGradient></defs><rect width="1200" height="1200" fill="url(#g)"/><rect x="300" y="350" width="600" height="500" rx="60" fill="#3b6ea5"/><circle cx="600" cy="600" r="120" fill="#f4efe6"/><ellipse cx="600" cy="900" rx="320" ry="40" fill="#8aa0b4" opacity="0.6"/></svg>',
    ),
  )
    .jpeg({ quality: 92 })
    .toBuffer();
  writeFixture("photos-reencoded-duplicate", [
    { file: "photo.jpg", bytes: scene, checks: clean },
    {
      file: "photo-small.jpg",
      bytes: await sharp(scene)
        .resize(600, 600)
        .jpeg({ quality: 80 })
        .toBuffer(),
    },
  ]);

  writeFixture("photos-checks-down", [
    { file: "a.png", bytes: blue, checks: refusal, escalated: refusal },
    { file: "b.png", bytes: red, checks: refusal, escalated: refusal },
    { file: "c.png", bytes: green, checks: refusal, escalated: refusal },
  ]);

  // Failures with a retryable cause throw; photos that are gone or unreadable end as no_photos.
  writeFixture("photos-unreachable", [
    { file: "down.png", bytes: Buffer.alloc(0), response: { status: 503 } },
    { file: "garbage.png", bytes: Buffer.from("not an image at all") },
  ]);

  writeFixture("photos-gone", [
    { file: "missing.png", bytes: Buffer.alloc(0), response: { status: 404 } },
    { file: "garbage.png", bytes: Buffer.from("not an image at all") },
  ]);

  // One good photo among four failing ones still trips the breaker, whatever the completion order.
  writeFixture("photos-checks-breaker", [
    { file: "a.png", bytes: blue, checks: refusal, escalated: refusal },
    { file: "b.png", bytes: red, checks: refusal, escalated: refusal },
    { file: "good.png", bytes: green, checks: clean },
    {
      file: "c.png",
      bytes: await flat("#445566"),
      checks: refusal,
      escalated: refusal,
    },
    {
      file: "d.png",
      bytes: await flat("#667788"),
      checks: refusal,
      escalated: refusal,
    },
  ]);

  writeFixture("photos-skipped", [
    { file: "ok.png", bytes: blue, checks: clean },
    { file: "missing.png", bytes: Buffer.alloc(0), response: { status: 404 } },
    { file: "garbage.png", bytes: Buffer.from("not an image at all") },
    {
      file: "cut-off.png",
      bytes: blue.subarray(0, 100),
      response: { status: 200, truncated: true },
    },
    {
      file: "internal.png",
      bytes: red,
      host: "https://internal.example/s/files/1/0001",
    },
    { file: "garbage-copy.png", bytes: Buffer.from("not an image at all") },
  ]);
}

main();
