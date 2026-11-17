import "server-only";
import { z } from "zod";
import { listAdminData, type AdminData } from "@/lib/db/queries";
import { judgeRecordSchema } from "@/lib/round";
import { brandKitSchema } from "@/lib/workspace/schemas";
import { signUrls } from "@/lib/workspace/urls";
import type { AdminCreative, AdminRound, BrandChange } from "./types";

const productSchema = z.object({
  shopify: z.object({ title: z.string() }),
  storeName: z.string().nullable(),
});

const editsSchema = z.array(z.unknown());

// Stored JSON is read with a schema; one that doesn't parse is logged with its row and treated as absent.
function read<T extends z.ZodType>(
  schema: T,
  value: unknown,
  what: string,
): z.infer<T> | null {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  console.error(`admin: ${what} is unreadable`, parsed.error);
  return null;
}

type BrandKit = z.infer<typeof brandKitSchema>;

const BRAND_FIELDS: [string, (kit: BrandKit) => string][] = [
  ["Primary colour", (kit) => kit.palette.primary ?? "none"],
  ["Secondary colour", (kit) => kit.palette.secondary ?? "none"],
  ["Background colour", (kit) => kit.palette.background ?? "none"],
  ["Text colour", (kit) => kit.palette.text ?? "none"],
  ["Theme colour", (kit) => kit.palette.themeColour ?? "none"],
  ["Heading font", (kit) => kit.fonts.heading.family],
  ["Body font", (kit) => kit.fonts.body.family],
  ["Tone", (kit) => kit.tone.join(", ")],
  ["Audience", (kit) => kit.audience],
  ["Value propositions", (kit) => kit.valuePropositions.join(", ")],
  ["Proof points", (kit) => kit.proofPoints.join(", ")],
];

function brandChanges(scraped: BrandKit, edited: BrandKit) {
  return BRAND_FIELDS.flatMap(([field, value]): BrandChange[] => {
    const before = value(scraped);
    const after = value(edited);
    return before === after ? [] : [{ field, scraped: before, edited: after }];
  });
}

function sumCosts(
  costs: AdminData["costs"],
  key: (cost: AdminData["costs"][number]) => string | null,
) {
  const sums = new Map<string, number>();
  for (const cost of costs) {
    const id = key(cost);
    if (id) sums.set(id, (sums.get(id) ?? 0) + Number(cost.usd ?? 0));
  }
  return sums;
}

function toCreative(row: AdminData["creatives"][number]): AdminCreative {
  const edits = read(editsSchema, row.edits, `creative ${row.id} edits`);
  return {
    n: row.n,
    angle: row.angle,
    previewPath: row.preview_path,
    previewUrl: null,
    rating:
      row.rating === "approve" || row.rating === "reject" ? row.rating : null,
    tags: row.tags,
    note: row.note,
    edits: edits?.length ?? 0,
    judge:
      row.judge === null
        ? null
        : read(judgeRecordSchema, row.judge, `creative ${row.id} judge`),
  };
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Newest first. A workspace with no round gets one row of its own, so every workspace shows. Pure: no signing, so the CSV export can use it too.
function buildRounds(data: AdminData): AdminRound[] {
  const testers = new Map(data.testers.map((t) => [t.user_id, t]));
  const roundCosts = sumCosts(data.costs, (c) => c.round_id);
  const setupCosts = sumCosts(
    data.costs.filter((c) => c.round_id === null),
    (c) => c.workspace_id,
  );
  const creatives = new Map<string, AdminCreative[]>();
  for (const row of data.creatives) {
    const list = creatives.get(row.round_id) ?? [];
    list.push(toCreative(row));
    creatives.set(row.round_id, list);
  }
  const roundsOf = new Map<string, AdminData["rounds"]>();
  for (const round of data.rounds) {
    roundsOf.set(round.workspace_id, [
      ...(roundsOf.get(round.workspace_id) ?? []),
      round,
    ]);
  }

  return data.workspaces
    .flatMap((workspace): AdminRound[] => {
      const tester = testers.get(workspace.user_id);
      if (!tester) return [];
      const product = read(
        productSchema,
        workspace.product,
        `workspace ${workspace.id} product`,
      );
      const scraped = read(
        brandKitSchema,
        workspace.brand_kit_scraped,
        `workspace ${workspace.id} scraped brand kit`,
      );
      const edited = read(
        brandKitSchema,
        workspace.brand_kit,
        `workspace ${workspace.id} brand kit`,
      );
      const shared = {
        tester: tester.name,
        golden: tester.is_golden,
        workspaceId: workspace.id,
        title: product?.shopify.title ?? "Untitled product",
        store: product?.storeName ?? hostOf(workspace.source_url),
        sourceUrl: workspace.source_url,
        deleted: workspace.deleted_at !== null,
        setupCost: setupCosts.get(workspace.id) ?? 0,
        brandChanges: scraped && edited ? brandChanges(scraped, edited) : null,
      };
      const rounds = roundsOf.get(workspace.id) ?? [];
      if (rounds.length === 0) {
        return [
          {
            ...shared,
            id: `workspace-${workspace.id}`,
            n: null,
            attempt: 1,
            status: "none",
            startedAt: workspace.created_at,
            durationS: null,
            briefVersion: 0,
            creatives: [],
            cost: 0,
          },
        ];
      }
      return rounds.map((round) => ({
        ...shared,
        id: round.id,
        n: round.n,
        attempt: round.attempt,
        status: round.status,
        startedAt: round.started_at,
        durationS:
          round.running_at && round.finished_at
            ? Math.round(
                (Date.parse(round.finished_at) - Date.parse(round.running_at)) /
                  1000,
              )
            : null,
        briefVersion: round.brief_version,
        creatives: (creatives.get(round.id) ?? []).sort((a, b) => a.n - b.n),
        cost: roundCosts.get(round.id) ?? 0,
      }));
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

// Cost rows with no workspace (a failed intake, chat before a workspace existed), per tester name; golden testers are left out.
function unattributedCosts(data: AdminData) {
  const golden = new Set(
    data.testers.filter((t) => t.is_golden).map((t) => t.user_id),
  );
  const names = new Map(data.testers.map((t) => [t.user_id, t.name]));
  return data.costs.flatMap((cost) => {
    const tester = names.get(cost.user_id);
    return cost.workspace_id === null &&
      tester !== undefined &&
      !golden.has(cost.user_id)
      ? [{ tester, usd: Number(cost.usd ?? 0) }]
      : [];
  });
}

export async function loadAdmin() {
  const data = await listAdminData();
  return { rounds: buildRounds(data), unattributed: unattributedCosts(data) };
}

// Thumbnails are signed for a few minutes, so they are added at render time.
export async function withPreviewUrls(rounds: AdminRound[]) {
  const urls = await signUrls(
    "previews",
    rounds.flatMap((round) => round.creatives.map((c) => c.previewPath)),
  );
  return rounds.map((round) => ({
    ...round,
    creatives: round.creatives.map((creative) => ({
      ...creative,
      previewUrl: urls.get(creative.previewPath) ?? null,
    })),
  }));
}
