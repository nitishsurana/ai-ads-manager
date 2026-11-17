// Workspaces built straight from a committed fixture, for screens the chat can't reach: fixtures that share a URL resolve to the first by name, and most have no homepage to replay, so they run without the brand stage and get the golden runner's stub brand.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createIntakeDeps,
  runIntake,
  runIntakeUntilBrand,
} from "../lib/intake";
import { photoRow, workspaceRow } from "../lib/intake/workflow/rows";
import { createSupabaseStorage } from "../lib/providers/storage";
import { stubBrand } from "../golden/stub-brand";
import { secret } from "./helpers";

type Seed = {
  userId: string;
  fixture: string;
  brandPages?: boolean;
  productKey?: string;
};

export async function seedWorkspace({
  userId,
  fixture,
  brandPages,
  productKey,
}: Seed) {
  process.env.PROVIDERS = "fake";
  const dir = join("golden", "fixtures", fixture);
  const { data: thread } = await secret
    .from("threads")
    .insert({ user_id: userId })
    .select("id")
    .single();
  const threadId = thread?.id ?? "";
  const { data: intake } = await secret
    .from("intakes")
    .insert({ user_id: userId, thread_id: threadId, url: `fixture:${fixture}` })
    .select("id")
    .single();
  const intakeId = intake?.id ?? "";

  const input = { url: fixtureUrl(dir), intakeId };
  const deps = createIntakeDeps({
    snapshotDir: dir,
    storage: createSupabaseStorage(secret),
    findWorkspace: async () => null,
  });
  const outcome = brandPages
    ? await runIntake(input, deps)
    : await runIntakeUntilBrand(input, deps);
  if (!outcome.ok || !("result" in outcome)) {
    throw new Error(`seed ${fixture}: the fixture did not produce a result`);
  }
  const result =
    "brand" in outcome.result
      ? outcome.result
      : { ...outcome.result, brand: stubBrand };
  // Fixtures share one URL, so each seeded workspace gets its own key unless a test needs a real one.
  result.productKey = productKey ?? `${fixture}-${intakeId}`;

  const { data, error } = await secret.rpc("complete_intake", {
    p_user_id: userId,
    p_intake_id: intakeId,
    p_workspace: workspaceRow(result),
    p_photos: result.photos.photos.map(photoRow),
    p_summary: {
      ui_id: `intake-${intakeId}-summary`,
      parts: [{ type: "text", text: `I read ${result.product.title}.` }],
    },
  });
  const workspaceId = (data as { workspaceId?: string } | null)?.workspaceId;
  if (error || !workspaceId) {
    throw new Error(`seed ${fixture}: ${error?.message ?? "no workspace"}`);
  }
  return { workspaceId, threadId, intakeId };
}

function fixtureUrl(dir: string) {
  const text = readFileSync(join(dir, "case.json"), "utf8");
  return (JSON.parse(text) as { url: string }).url;
}
