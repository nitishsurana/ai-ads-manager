import "server-only";
import { createSecretClient } from "../secret";
import { check } from "./error";

const PAGE_SIZE = 1000;

// PostgREST caps a response at its max rows, so every list is read in ordered pages until one comes back empty.
async function fetchAll<Row>(
  operation: string,
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: Row[] | null;
    error: { message: string } | null;
  }>,
) {
  const rows: Row[] = [];
  for (let from = 0; ;) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    check(error, operation);
    if (!data?.length) return rows;
    rows.push(...data);
    from += data.length;
  }
}

// Every tester's rows on purpose, soft-deleted workspaces included: this is the admin's view, reached only through requireAdmin.
export async function listAdminData() {
  const client = createSecretClient();
  const [testers, workspaces, rounds, creatives, costs] = await Promise.all([
    fetchAll("admin testers", (from, to) =>
      client
        .from("testers")
        .select("user_id, name, is_golden")
        .order("user_id")
        .range(from, to),
    ),
    fetchAll("admin workspaces", (from, to) =>
      client
        .from("workspaces")
        .select(
          "id, user_id, source_url, product, brand_kit_scraped, brand_kit, deleted_at, created_at",
        )
        .order("id")
        .range(from, to),
    ),
    fetchAll("admin rounds", (from, to) =>
      client
        .from("rounds")
        .select(
          "id, workspace_id, n, attempt, status, brief_version, started_at, running_at, finished_at",
        )
        .order("id")
        .range(from, to),
    ),
    fetchAll("admin creatives", (from, to) =>
      client
        .from("creatives")
        .select(
          "id, round_id, n, angle, preview_path, judge, rating, tags, note, edits",
        )
        .order("id")
        .range(from, to),
    ),
    fetchAll("admin costs", (from, to) =>
      client
        .from("costs")
        .select("user_id, round_id, workspace_id, usd")
        .order("id")
        .range(from, to),
    ),
  ]);
  return { testers, workspaces, rounds, creatives, costs };
}

export type AdminData = Awaited<ReturnType<typeof listAdminData>>;
