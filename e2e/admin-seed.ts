// Rounds, creatives and costs written straight into the tables, for the admin screen: judge records follow judgeRecordSchema and the rows satisfy the rounds migration's checks.
import { secret } from "./helpers";
import { seedWorkspace } from "./seed";

// A 1x1 PNG, so the thumbnails have a real object to sign.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
  "base64",
);

const DAY_MS = 24 * 60 * 60 * 1000;

const criteria = (score: number) => ({
  message: score,
  hierarchy: score,
  product: score,
  brand_fit: score,
  slop: score,
});

// Three judges, so the panel median is a whole score; a low-confidence record has judges two points apart.
export function judgeRecord(median: number, lowConfidence: boolean) {
  const reasons = {
    message: "Clear offer.",
    hierarchy: "Headline leads.",
    product: "Product is sharp.",
    brand_fit: "Fits the brand.",
    slop: "No artefacts.",
  };
  const scores = lowConfidence
    ? [median + 1, median, median - 1]
    : [median, median, median];
  return {
    medians: criteria(median),
    mean: median,
    lowConfidence,
    pass: median >= 3,
    borda: 1,
    rank: 1,
    judges: ["anthropic/claude-a", "google/gemini-b", "openai/gpt-c"].map(
      (model, i) => ({
        model,
        scores: criteria(scores[i] ?? median),
        reasons,
        rank: i + 1,
      }),
    ),
  };
}

export type SeedCreative = {
  rating: "approve" | "reject" | null;
  tags?: string[];
  note?: string;
  edits?: unknown[];
  judge: ReturnType<typeof judgeRecord>;
};

type SeedWorkspace = {
  userId: string;
  title: string;
  setupCost?: number;
  deleted?: boolean;
  audience?: string;
};

type SeedRound = SeedWorkspace & {
  creatives: SeedCreative[];
  roundCosts: number[];
  daysAgo?: number;
};

async function insert<Row extends { id: string }>(
  table: "briefs" | "rounds" | "creatives" | "costs",
  rows: object[],
) {
  const { data, error } = await secret
    .from(table)
    .insert(rows as never)
    .select("id");
  if (error) throw new Error(`admin seed ${table}: ${error.message}`);
  return (data ?? []) as Row[];
}

// A workspace with no round, whose setup cost is a cost row with no round.
export async function seedAdminWorkspace(input: SeedWorkspace) {
  const { workspaceId } = await seedWorkspace({
    userId: input.userId,
    fixture: "brand-name-header-text",
    brandPages: true,
  });
  const { data: workspace } = await secret
    .from("workspaces")
    .select("product, brand_kit")
    .eq("id", workspaceId)
    .single();
  const product = workspace?.product as { shopify: { title: string } };
  const brandKit = workspace?.brand_kit as { audience: string };
  const { error } = await secret
    .from("workspaces")
    .update({
      product: {
        ...product,
        shopify: { ...product.shopify, title: input.title },
      },
      brand_kit: input.audience
        ? { ...brandKit, audience: input.audience }
        : brandKit,
      deleted_at: input.deleted ? new Date().toISOString() : null,
    })
    .eq("id", workspaceId);
  if (error) throw new Error(`admin seed workspace: ${error.message}`);

  const costs = input.setupCost
    ? await insert("costs", [
        {
          user_id: input.userId,
          workspace_id: workspaceId,
          provider: "firecrawl",
          usd: input.setupCost,
        },
      ])
    : [];
  return {
    workspaceId,
    roundId: null as string | null,
    costIds: costs.map((cost) => cost.id),
  };
}

// One workspace with a finished round 1. Returns the ids the spec cleans up.
export async function seedAdminRound(input: SeedRound) {
  const { workspaceId, costIds: setupIds } = await seedAdminWorkspace(input);
  await insert("briefs", [
    {
      workspace_id: workspaceId,
      user_id: input.userId,
      version: 1,
      cause: "initial",
      content: {},
    },
  ]);
  const started = Date.now() - (input.daysAgo ?? 0) * DAY_MS;
  const [round] = await insert("rounds", [
    {
      workspace_id: workspaceId,
      user_id: input.userId,
      n: 1,
      attempt: 1,
      status: "done",
      inputs: {},
      brief_version: 1,
      started_at: new Date(started).toISOString(),
      running_at: new Date(started + 1_000).toISOString(),
      finished_at: new Date(started + 134_000).toISOString(),
    },
  ]);
  const roundId = round?.id ?? "";

  for (const [i] of input.creatives.entries()) {
    const { error: uploadError } = await secret.storage
      .from("previews")
      .upload(`${roundId}/${i + 1}.png`, PIXEL, { contentType: "image/png" });
    if (uploadError)
      throw new Error(`admin seed preview: ${uploadError.message}`);
  }
  await insert(
    "creatives",
    input.creatives.map((creative, i) => ({
      round_id: roundId,
      user_id: input.userId,
      n: i + 1,
      angle: "benefit",
      background: { method: "solid", reason: "seed" },
      copy: {},
      preview_path: `${roundId}/${i + 1}.png`,
      judge: creative.judge,
      rating: creative.rating,
      tags: creative.tags ?? [],
      note: creative.note ?? null,
      edits: creative.edits ?? [],
    })),
  );
  const costs = await insert(
    "costs",
    input.roundCosts.map((usd) => ({
      user_id: input.userId,
      workspace_id: workspaceId,
      round_id: roundId,
      provider: "ai",
      model: "seed",
      usd,
    })),
  );
  return {
    workspaceId,
    roundId,
    costIds: [...setupIds, ...costs.map((cost) => cost.id)],
  };
}
