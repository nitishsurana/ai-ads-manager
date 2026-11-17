// The spend cap is one budget shared by every tester and every checkout on this Supabase project, so the over-cap cost lives only as long as one test. Run with a low cap (SPEND_CAP_USD_DAILY=1) so other checkouts on the default cap aren't blocked meanwhile; Playwright passes it to the dev server it starts.
import { expect, test, type Request } from "@playwright/test";
import { generate, workspaceRow } from "./confirm-helpers";
import {
  FAKE_PROVIDERS,
  resetTesters,
  secret,
  testerContext,
  testerIds,
} from "./helpers";
import { seedWorkspace } from "./seed";

const CAP = Number(process.env.SPEND_CAP_USD_DAILY ?? 5);
const SPEND_CAP =
  "Today's spend limit for the test has been reached. Try again tomorrow.";
const KEEPALIVE = "/api/cron/keepalive";

async function spendToday() {
  const { data, error } = await secret.rpc("spend_today_usd");
  if (error) throw new Error(error.message);
  return Number(data);
}

async function seedCost(userId: string, usd: number) {
  const { error } = await secret
    .from("costs")
    .insert({ user_id: userId, provider: "ai", usd, meta: { e2e: "limits" } });
  if (error) throw new Error(error.message);
}

async function removeSeededCosts() {
  await secret.from("costs").delete().eq("meta->>e2e", "limits");
}

async function setGolden(userId: string, isGolden: boolean) {
  await secret
    .from("testers")
    .update({ is_golden: isGolden })
    .eq("user_id", userId);
}

test.describe("spend cap", () => {
  test.skip(!FAKE_PROVIDERS, "replays committed fixtures");
  test.describe.configure({ mode: "serial" });

  let a: Awaited<ReturnType<typeof testerContext>>;
  let workspaceId: string;
  let generateRequest: Request;

  test.beforeAll(async ({ browser }) => {
    a = await testerContext(browser, "a");
    ({ workspaceId } = await seedWorkspace({
      userId: a.uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    }));
  });
  test.afterAll(async () => {
    await removeSeededCosts();
    await setGolden(testerIds().b, false);
    await a?.context.close();
    await resetTesters();
  });

  test("golden testers' costs don't count toward the cap", async () => {
    const { page } = a;
    const golden = testerIds().b;
    await setGolden(golden, true);
    await seedCost(golden, CAP + 10);
    expect(await spendToday()).toBeLessThan(CAP);

    await page.goto(`/w/${workspaceId}`);
    await expect(generate(page)).toBeEnabled();
    await expect(page.getByText(SPEND_CAP)).toHaveCount(0);

    // Keep the Generate request for the replay below without letting it reach the server.
    await page.route(`**/w/${workspaceId}`, (route) =>
      "next-action" in route.request().headers()
        ? route.abort()
        : route.continue(),
    );
    const sent = page.waitForRequest(
      (r) => r.method() === "POST" && "next-action" in r.headers(),
    );
    await generate(page).click();
    generateRequest = await sent;
    await page.unroute(`**/w/${workspaceId}`);
  });

  test("over the cap, Generate is disabled with the message and a replayed Generate is refused", async () => {
    const { page, context } = a;
    try {
      await seedCost(a.uid, CAP - (await spendToday()) + 0.01);

      await page.goto(`/w/${workspaceId}`);
      await expect(generate(page)).toBeDisabled();
      await expect(page.getByText(SPEND_CAP)).toBeVisible();

      const replay = await context.request.post(`/w/${workspaceId}`, {
        headers: {
          "next-action": generateRequest.headers()["next-action"] ?? "",
          "content-type": "text/plain;charset=UTF-8",
        },
        data: generateRequest.postData() ?? "",
      });
      expect(await replay.text()).toContain("spend_cap");
      expect((await workspaceRow(workspaceId))?.phase).toBe("confirm");

      // Edit mode only saves, so the cap doesn't block it.
      await secret
        .from("workspaces")
        .update({ phase: "rounds" })
        .eq("id", workspaceId);
      await page.goto(`/w/${workspaceId}/confirm`);
      await expect(
        page.getByRole("button", { name: "Save changes" }),
      ).toBeEnabled();
      await expect(page.getByText(SPEND_CAP)).toHaveCount(0);
    } finally {
      await removeSeededCosts();
    }
  });
});

test.describe("keep-alive cron", () => {
  test("is refused without the secret or with a wrong one", async ({
    request,
  }) => {
    expect((await request.get(KEEPALIVE)).status()).toBe(401);
    const wrong = await request.get(KEEPALIVE, {
      headers: { Authorization: "Bearer not-the-secret" },
    });
    expect(wrong.status()).toBe(401);
  });

  test("runs a real query with the secret", async ({ request }) => {
    const response = await request.get(KEEPALIVE, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      testers: expect.any(Number),
    });
  });
});
