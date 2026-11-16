// Needs the step 1 migration applied to the Supabase project in .env.local (npm run db:push) and `npm run dev` under Workflows.
// INTAKE_E2E_URL names a real Shopify product page for the success case; it spends Firecrawl, AI Gateway and Fal credits.
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TESTER_PASSWORD = process.env.TESTER_PASSWORD ?? "";
const PRODUCT_URL = process.env.INTAKE_E2E_URL;
const BUCKETS = ["photos", "cutouts", "logos"];

const secret = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);

const userIds = new Set<string>();
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
  // Deleting the user cascades to its threads, intakes, workspaces, photos and costs.
  for (const id of userIds) await secret.auth.admin.deleteUser(id);
});

async function signedInContext(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Your name").fill("Intake test");
  await page.getByLabel("Tester password").fill(TESTER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  const cookie = (await context.cookies()).find((c) => c.name === "tester");
  const body = (cookie?.value ?? "").split(".")[0] ?? "";
  const { uid } = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  userIds.add(uid as string);
  return { context, uid: uid as string };
}

async function runIntake(context: BrowserContext, url: string) {
  const started = await context.request.post("/api/dev/start-intake", {
    data: { url },
  });
  expect(started.status()).toBe(200);
  const { intakeId, threadId } = (await started.json()) as {
    intakeId: string;
    threadId: string;
  };
  intakeIds.add(intakeId);

  let intake:
    | {
        status: string;
        failure_code: string | null;
        workspace_id: string | null;
      }
    | undefined;
  await expect
    .poll(
      async () => {
        const response = await context.request.get(
          `/api/dev/intake/${intakeId}`,
        );
        intake = await response.json();
        return intake?.status;
      },
      { timeout: 5 * 60_000, intervals: [2_000] },
    )
    .not.toBe("reading");
  return { intakeId, threadId, intake: intake! };
}

test("a failing URL fails the intake with its message and leaves nothing behind", async ({
  browser,
}) => {
  const { context, uid } = await signedInContext(browser);
  const { intakeId, threadId, intake } = await runIntake(
    context,
    "https://example.com/products/anything",
  );
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
            .eq("thread_id", threadId)
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
  test.skip(!PRODUCT_URL, "set INTAKE_E2E_URL to run the paid success case");
  const { context, uid } = await signedInContext(browser);
  const { intakeId, threadId, intake } = await runIntake(
    context,
    PRODUCT_URL ?? "",
  );
  expect(intake.status).toBe("done");
  expect(intake.workspace_id).not.toBeNull();

  const { data: workspace } = await secret
    .from("workspaces")
    .select("user_id, thread_id, phase, confirmed")
    .eq("id", intake.workspace_id ?? "")
    .single();
  expect(workspace).toEqual({
    user_id: uid,
    thread_id: threadId,
    phase: "confirm",
    confirmed: null,
  });

  const { data: thread } = await secret
    .from("threads")
    .select("workspace_id")
    .eq("id", threadId)
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
    .eq("thread_id", threadId);
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
