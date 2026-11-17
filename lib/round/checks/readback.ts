import sharp from "sharp";
import { z } from "zod";
import { sha256 } from "@/lib/providers/snapshot";
import { CANVAS, type Box, type Layout } from "@/lib/render";
import type { StageDeps } from "../stages/types";

export const READBACK_MODEL = "anthropic/claude-haiku-5.5";
export const READBACK_TIMEOUT_MS = 20_000;
const PAD = 12;

const readbackSchema = z.object({
  eyebrow: z.string().nullable(),
  headline: z.string().nullable(),
  cta: z.string().nullable(),
  badge: z.array(
    z.object({
      text: z.string(),
      struck_through: z.boolean(),
      has_star: z.boolean(),
    }),
  ),
});

export type Readback = z.infer<typeof readbackSchema>;

const SYSTEM = `You read the text in cropped regions of a finished ad. Each attached image is one region, in the order listed. Transcribe exactly what is drawn in each region, character for character, keeping its case. Do not correct, complete or guess. Ignore anything that belongs to a photo or is printed on a product, such as labels, packaging or signs. A region with no drawn text is null (an empty list for the badge).
- eyebrow: a small line of capital letters above the headline.
- headline: the large text.
- cta: the label inside the button.
- badge: the badge's lines from top to bottom. For each line set struck_through when a line is drawn through it, and has_star when a star icon sits before it; leave the star out of the text.`;

type Region = "eyebrow" | "headline" | "cta" | "badge";

export function regionsOf(layout: Layout): { id: Region; box: Box }[] {
  return [
    ...(layout.eyebrow
      ? [{ id: "eyebrow" as const, box: layout.eyebrow.box }]
      : []),
    { id: "headline" as const, box: layout.headline.box },
    { id: "cta" as const, box: layout.cta.box },
    ...(layout.badge ? [{ id: "badge" as const, box: layout.badge.box }] : []),
  ];
}

async function crop(png: Buffer, box: Box) {
  const left = Math.max(0, Math.floor(box.x - PAD));
  const top = Math.max(0, Math.floor(box.y - PAD));
  const right = Math.min(CANVAS.width, Math.ceil(box.x + box.w + PAD));
  const bottom = Math.min(CANVAS.height, Math.ceil(box.y + box.h + PAD));
  return sharp(png)
    .extract({ left, top, width: right - left, height: bottom - top })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92 })
    .toBuffer();
}

// What a read-back should say for a layout: what is compared against, and the answer of the fake reader.
export function intendedReadback(layout: Layout): Readback {
  const joined = (lines: string[]) => lines.join(" ");
  return {
    eyebrow: layout.eyebrow ? joined(layout.eyebrow.lines) : null,
    headline: joined(layout.headline.lines),
    cta: joined(layout.cta.lines),
    badge: (layout.badge?.rows ?? []).map((row) => ({
      text: row.text,
      struck_through: row.strike,
      has_star: row.star,
    })),
  };
}

// Reads the text regions of a finished creative back; the read-back of a fake round is the layout's own text.
export type ReadBack = (png: Buffer, layout: Layout) => Promise<Readback>;

// Haiku sees only the cropped regions and is not told what they should say.
export const createReadBack =
  (deps: Pick<StageDeps, "ai">): ReadBack =>
  (png, layout) =>
    readRegions(png, layout, deps);

async function readRegions(
  png: Buffer,
  layout: Layout,
  deps: Pick<StageDeps, "ai">,
): Promise<Readback> {
  const regions = regionsOf(layout);
  const images = await Promise.all(regions.map(({ box }) => crop(png, box)));
  const { object } = await deps.ai.generate({
    task: "readback",
    inputSha256: sha256(
      Buffer.from(images.map((image) => sha256(image)).join("\n")),
    ),
    model: READBACK_MODEL,
    system: SYSTEM,
    prompt: `The regions, in image order: ${regions.map(({ id }, i) => `${i + 1} = ${id}`).join(", ")}.`,
    images,
    timeoutMs: READBACK_TIMEOUT_MS,
    schema: readbackSchema,
  });
  return object;
}

const STARS = /[★☆⭐✭✮✯⋆*]/g;

// Case, spacing, quote and dash styles and star glyphs don't count; the SVG star compares as "★".
export function normalise(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(STARS, "★")
    .toLowerCase()
    .replace(/\s+/g, "");
}

const starred = (text: string, star: boolean) => {
  const bare = text.replace(/^\s*[★☆⭐✭✮✯⋆*]+/, "");
  return star || bare !== text ? `★${bare}` : bare;
};

// The mismatches between what the layout draws and what was read back.
export function readbackProblems(layout: Layout, read: Readback) {
  const intended = intendedReadback(layout);
  const problems: string[] = [];
  const compare = (part: string, expected: string, actual: string | null) => {
    if (normalise(expected) !== normalise(actual ?? "")) {
      problems.push(
        `readback ${part}: read "${actual ?? ""}", drew "${expected}"`,
      );
    }
  };
  if (intended.eyebrow !== null)
    compare("eyebrow", intended.eyebrow, read.eyebrow);
  compare("headline", intended.headline ?? "", read.headline);
  compare("cta", intended.cta ?? "", read.cta);

  const badge = layout.badge;
  if (!badge) return problems;
  if (badge.kind === "offer") {
    compare(
      "badge",
      badge.rows.map((row) => row.text).join(" "),
      read.badge.map((row) => row.text).join(" "),
    );
    return problems;
  }
  if (read.badge.length !== badge.rows.length) {
    problems.push(
      `readback badge: read ${read.badge.length} lines, drew ${badge.rows.length}`,
    );
    return problems;
  }
  badge.rows.forEach((row, i) => {
    const got = read.badge[i];
    if (!got) return;
    compare(
      `badge line ${i + 1}`,
      starred(row.text, row.star),
      starred(got.text, got.has_star),
    );
    if (got.struck_through !== row.strike) {
      problems.push(
        `readback badge line ${i + 1}: ${row.strike ? "the strike-through was not seen" : "a strike-through was read that was not drawn"}`,
      );
    }
  });
  return problems;
}
