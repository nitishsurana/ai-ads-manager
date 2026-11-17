// Drives intakes through the chat. Needs the step 1 migration applied to the Supabase project in .env.local (npm run db:push) and `npm run dev` under Workflows.
// By default the Playwright config runs PROVIDERS=fake, which replays golden/fixtures. The paid success case needs real providers: set PROVIDERS=real and INTAKE_E2E_URL to a real Shopify product page; it spends Firecrawl, AI Gateway and Fal credits.
import { expect, test } from "@playwright/test";
import {
  deleteUsers,
  FAKE_PROVIDERS,
  intakeIdOf,
  secret,
  sendMessage,
  signedInContext,
} from "./helpers";

const PRODUCT_URL = process.env.INTAKE_E2E_URL;
const FAILING_URL = FAKE_PROVIDERS
  ? "https://plain.example/products/blue-mug"
  : "https://example.com/products/anything";
const BUCKETS = ["photos", "cutouts", "logos"];
const NAVIGATE_TIMEOUT = 30_000;

const intakeIds = new Set<string>();

test.afterAll(async () => {
  for (const id of intakeIds) {
    for (const bucket of BUCKETS) {
      const { data } = await secret.storage.from(bucket).list(id);
      if (data?.length) {
        await secret.storage
          .from(bucket)
          .remove(data.map((file) => `${id}/${file.name}`));
      }
    }
  }
  await deleteUsers();
});

async function runIntake(
  page: Awaited<ReturnType<typeof signedInContext>>["page"],
  url: string,
) {
  await sendMessage(page, url);
  await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/, {
    timeout: NAVIGATE_TIMEOUT,
  });
  const intakeId = intakeIdOf(page);
  intakeIds.add(intakeId);

  await expect
    .poll(
      async () =>
        (
          await secret
            .from("intakes")
            .select("status")
            .eq("id", intakeId)
            .single()
        ).data?.status,
      { timeout: 5 * 60_000, intervals: [2_000] },
    )
    .not.toBe("reading");
  const { data: intake } = await secret
    .from("intakes")
    .select("status, failure_code, workspace_id, thread_id")
    .eq("id", intakeId)
    .single();
  return { intakeId, intake: intake! };
}

test("a failing URL fails the intake with its message and leaves nothing behind", async ({
  browser,
}) => {
  const { context, page, uid } = await signedInContext(browser, "Intake test");
  const { intakeId, intake } = await runIntake(page, FAILING_URL);
  expect(intake).toMatchObject({
    status: "failed",
    failure_code: "not_shopify",
  });

  // Status flips first; the cleanup and the message follow.
  await expect
    .poll(
      async () =>
        (
          await secret
            .from("messages")
            .select("kind, role, parts")
            .eq("thread_id", intake.thread_id)
            .eq("kind", "status")
        ).data,
      { timeout: 30_000 },
    )
    .toEqual([
      {
        kind: "status",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Only Shopify product pages are supported for now.",
          },
        ],
      },
    ]);
  const { count: photos } = await secret
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("intake_id", intakeId);
  expect(photos).toBe(0);
  const { data: workspaces } = await secret
    .from("workspaces")
    .select("id")
    .eq("user_id", uid);
  expect(workspaces).toEqual([]);
  await context.close();
});

test("a real product becomes a workspace with photos, a summary and costs", async ({
  browser,
}) => {
  test.setTimeout(6 * 60_000);
  test.skip(
    FAKE_PROVIDERS || !PRODUCT_URL,
    "set PROVIDERS=real and INTAKE_E2E_URL to run the paid success case",
  );
  const { context, page, uid } = await signedInContext(browser, "Intake test");
  const { intakeId, intake } = await runIntake(page, PRODUCT_URL ?? "");
  expect(intake.status).toBe("done");
  expect(intake.workspace_id).not.toBeNull();

  const { data: workspace } = await secret
    .from("workspaces")
    .select("user_id, thread_id, phase, confirmed")
    .eq("id", intake.workspace_id ?? "")
    .single();
  expect(workspace).toEqual({
    user_id: uid,
    thread_id: intake.thread_id,
    phase: "confirm",
    confirmed: null,
  });

  const { data: thread } = await secret
    .from("threads")
    .select("workspace_id")
    .eq("id", intake.thread_id)
    .single();
  expect(thread).toEqual({ workspace_id: intake.workspace_id });

  const { data: photos } = await secret
    .from("photos")
    .select("workspace_id, selected")
    .eq("intake_id", intakeId);
  expect(photos?.length).toBeGreaterThan(0);
  expect(photos?.every((p) => p.workspace_id === intake.workspace_id)).toBe(
    true,
  );
  expect(photos?.some((p) => p.selected)).toBe(true);

  const { data: summary } = await secret
    .from("messages")
    .select("kind")
    .eq("thread_id", intake.thread_id)
    .eq("kind", "summary");
  expect(summary).toEqual([{ kind: "summary" }]);

  const { data: costs } = await secret
    .from("costs")
    .select("provider, usd")
    .eq("intake_id", intakeId);
  const providers = new Set(costs?.map((c) => c.provider));
  expect(providers).toContain("firecrawl");
  expect(
    costs?.some((c) => c.provider === "ai" && typeof c.usd === "number"),
  ).toBe(true);

  const { data: files } = await secret.storage.from("photos").list(intakeId);
  expect(files?.length).toBeGreaterThan(0);
  expect(
    costs?.filter((c) => c.provider === "firecrawl").length,
  ).toBeGreaterThanOrEqual(2);
  await context.close();
});
