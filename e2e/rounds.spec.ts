// Runs against `next dev` with PROVIDERS=fake and the shortened timers of e2e/timers.ts. The stub stages make fake candidates; faults are injected through the campaign occasion ("fake:slow", "fake:no_pass", "fake:fail"). Workspaces are seeded (see seed.ts), and some rounds are inserted straight into the database to set up a case.
import { expect, test, type Page } from "@playwright/test";
import { generate, nextAction, roundsOf } from "./confirm-helpers";
import {
  FAKE_PROVIDERS,
  removeRoundFiles,
  resetTesters,
  secret,
  sendMessage,
  testerContext,
} from "./helpers";
import { seedWorkspace } from "./seed";
import { ROUND_TIMERS } from "./timers";

const SCREEN_TIMEOUT = 60_000;
const FAILED = "Something went wrong making this round. Try again.";
const TIMED_OUT = "This is taking too long. You can retry in 5 minutes.";
const NO_PASS =
  "We couldn't make creatives that pass our checks this time. Add more detail or update what you told us, then try again.";
const DAILY_LIMIT =
  "You've reached today's limit of 20 rounds. Try again tomorrow.";
const BRIEF_CONTENT = {
  rules: [],
  campaign: {},
  research: [],
  values: {
    price: null,
    wasPrice: null,
    currency: "USD",
    rating: null,
    brandName: null,
  },
  exemplarCreativeIds: [],
  approvedAngles: [],
};

test.skip(!FAKE_PROVIDERS, "replays committed fixtures");
test.afterAll(resetTesters);
test.describe.configure({ mode: "serial" });

async function briefsOf(workspaceId: string) {
  const { data } = await secret
    .from("briefs")
    .select("version, cause, content")
    .eq("workspace_id", workspaceId)
    .order("version");
  return data ?? [];
}

async function previewFiles(roundId: string) {
  const { data } = await secret.storage.from("previews").list(roundId);
  return data?.map((file) => file.name).sort() ?? [];
}

const roundOf = async (workspaceId: string, index = 0) =>
  (await roundsOf(workspaceId))[index];

// A round that is already over, inserted for cases the UI can't reach.
async function insertRounds(
  userId: string,
  workspaceId: string,
  rounds: Record<string, unknown>[],
) {
  await secret.from("briefs").insert({
    workspace_id: workspaceId,
    user_id: userId,
    version: 1,
    cause: "initial",
    content: BRIEF_CONTENT,
  });
  await secret
    .from("workspaces")
    .update({ phase: "rounds" })
    .eq("id", workspaceId);
  const { error } = await secret.from("rounds").insert(
    rounds.map((round) => ({
      workspace_id: workspaceId,
      user_id: userId,
      brief_version: 1,
      inputs: {},
      ...round,
    })),
  );
  expect(error).toBeNull();
}

const tryAgain = (page: Page) =>
  page.getByRole("button", { name: "Try again" });

test.describe("rounds", () => {
  let a: Awaited<ReturnType<typeof testerContext>>;
  let generateAction = "";

  test.beforeAll(async ({ browser }) => {
    a = await testerContext(browser, "a");
  });
  test.afterAll(async () => {
    await a?.context.close();
  });

  const replay = (id: string) =>
    a.page.context().request.post(`/w/${id}`, {
      headers: {
        "next-action": generateAction,
        "content-type": "text/plain;charset=UTF-8",
      },
      data: JSON.stringify([id]),
    });

  const seed = () =>
    seedWorkspace({
      userId: a.uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    });

  test("Generate runs queued to running to done with stub creatives, and the next round rewrites the brief", async ({
    browser,
  }) => {
    test.setTimeout(3 * SCREEN_TIMEOUT);
    const { page } = a;
    const { workspaceId } = await seed();
    await page.goto(`/w/${workspaceId}`);
    const request = nextAction(page);
    await generate(page).click();
    generateAction = (await request).headers()["next-action"] ?? "";
    await expect(page.getByRole("heading", { name: "Round 1" })).toBeVisible();

    await expect
      .poll(async () => (await roundOf(workspaceId))?.status, {
        timeout: SCREEN_TIMEOUT,
      })
      .toBe("done");
    await expect(page.getByText("3 creatives ready")).toBeVisible();
    const previews = page.getByRole("img", { name: /^Creative/ });
    await expect(previews).toHaveCount(3);
    await expect
      .poll(() =>
        previews.first().evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);

    const round = await roundOf(workspaceId);
    expect(round).toMatchObject({
      n: 1,
      attempt: 1,
      brief_version: 1,
      error: null,
    });
    expect(round?.running_at).not.toBeNull();
    expect(round?.deadline_at).not.toBeNull();
    expect(round?.finished_at).not.toBeNull();
    expect(round?.progress).toMatchObject({
      counts: { checking_quality: { done: 6, total: 6 } },
    });
    expect((await briefsOf(workspaceId)).map((b) => b.cause)).toEqual([
      "initial",
    ]);
    expect(
      (
        await secret
          .from("workspaces")
          .select("phase")
          .eq("id", workspaceId)
          .single()
      ).data?.phase,
    ).toBe("rounds");
    // Only the three shown creatives keep a file.
    expect(await previewFiles(round?.id ?? "")).toHaveLength(3);
    const creatives = await secret
      .from("creatives")
      .select("n, rating")
      .eq("round_id", round?.id ?? "");
    expect(creatives.data).toHaveLength(3);

    const b = await testerContext(browser, "b");
    expect(
      (await b.context.request.get(`/api/rounds/${round?.id}`)).status(),
    ).toBe(404);
    await b.context.close();

    // The next round needs every creative rated, then rewrites the brief (a copy for now).
    expect(await (await replay(workspaceId)).text()).toContain("unrated");
    expect(await roundsOf(workspaceId)).toHaveLength(1);

    await secret
      .from("creatives")
      .update({ rating: "approve" })
      .eq("round_id", round?.id ?? "");
    expect(await (await replay(workspaceId)).text()).toContain("roundId");
    await expect
      .poll(async () => (await roundOf(workspaceId, 1))?.status, {
        timeout: SCREEN_TIMEOUT,
      })
      .toBe("done");
    expect(await roundOf(workspaceId, 1)).toMatchObject({
      n: 2,
      attempt: 1,
      brief_version: 2,
    });
    expect((await briefsOf(workspaceId)).map((b) => b.cause)).toEqual([
      "initial",
      "round",
    ]);
  });

  test("a queued round whose workflow never started fails after STALE_QUEUED_S and retries at once", async () => {
    test.setTimeout(3 * SCREEN_TIMEOUT);
    const { page, uid } = a;
    const { workspaceId } = await seed();
    await insertRounds(uid, workspaceId, [
      { n: 1, attempt: 1, started_at: new Date().toISOString() },
    ]);
    await page.goto(`/w/${workspaceId}`);
    await expect(page.getByText("Waiting to start")).toBeVisible();

    await expect(page.getByText(FAILED)).toBeVisible({
      timeout: (ROUND_TIMERS.staleQueuedS + 20) * 1000,
    });
    expect(await roundOf(workspaceId)).toMatchObject({
      status: "failed",
      error: "stale_queued",
      running_at: null,
    });

    await tryAgain(page).click();
    await expect(
      page.getByRole("heading", { name: "Round 1, attempt 2" }),
    ).toBeVisible();
    await expect
      .poll(async () => (await roundOf(workspaceId, 1))?.status, {
        timeout: SCREEN_TIMEOUT,
      })
      .toBe("done");
  });

  test("a deadline overrun times out with the 3-minute message, locks the confirm screen while it runs, and waits RETRY_WAIT_S", async () => {
    test.setTimeout(4 * SCREEN_TIMEOUT);
    const { page } = a;
    const { workspaceId } = await seed();
    await secret
      .from("workspaces")
      .update({ campaign: { occasion: "fake:slow" } })
      .eq("id", workspaceId);
    await page.goto(`/w/${workspaceId}`);
    await generate(page).click();
    await expect(page.getByRole("heading", { name: "Round 1" })).toBeVisible();
    await expect
      .poll(async () => (await roundOf(workspaceId))?.status)
      .toBe("running");

    await page.goto(`/w/${workspaceId}/confirm`);
    await expect(
      page.getByText(
        "A round is running. You can change these once it finishes.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save changes" }),
    ).toBeDisabled();

    await page.goto(`/w/${workspaceId}`);
    await expect(page.getByText(TIMED_OUT)).toBeVisible({
      timeout: (ROUND_TIMERS.deadlineS + 20) * 1000,
    });
    const round = await roundOf(workspaceId);
    expect(round).toMatchObject({ status: "timed_out" });
    expect(new Date(round?.finished_at ?? "").getTime()).toBe(
      new Date(round?.deadline_at ?? "").getTime(),
    );
    expect(round?.running_at).not.toBeNull();
    expect(await previewFiles(round?.id ?? "")).toEqual([]);

    await page.goto(`/w/${workspaceId}/confirm`);
    await expect(
      page.getByText(
        "A round is running. You can change these once it finishes.",
      ),
    ).toHaveCount(0);

    await page.goto(`/w/${workspaceId}`);
    await expect(tryAgain(page)).toBeDisabled();
    expect(await (await replay(workspaceId)).text()).toContain("retry_wait");
    expect(await roundsOf(workspaceId)).toHaveLength(1);
    await expect(page.getByText(TIMED_OUT)).toHaveCount(1);

    await secret
      .from("workspaces")
      .update({ campaign: {} })
      .eq("id", workspaceId);
    await expect(tryAgain(page)).toBeEnabled({
      timeout: (ROUND_TIMERS.retryWaitS + 10) * 1000,
    });
    await tryAgain(page).click();
    await expect(
      page.getByRole("heading", { name: "Round 1, attempt 2" }),
    ).toBeVisible();
    await expect
      .poll(async () => (await roundOf(workspaceId, 1))?.status, {
        timeout: SCREEN_TIMEOUT,
      })
      .toBe("done");
  });

  for (const [fault, status, message] of [
    ["no_pass", "no_pass", NO_PASS],
    ["fail", "failed", FAILED],
  ] as const) {
    test(`a ${fault} round shows its message, keeps no files and retries at once`, async () => {
      test.setTimeout(3 * SCREEN_TIMEOUT);
      const { page } = a;
      const { workspaceId } = await seed();
      await secret
        .from("workspaces")
        .update({ campaign: { occasion: `fake:${fault}` } })
        .eq("id", workspaceId);
      await page.goto(`/w/${workspaceId}`);
      await generate(page).click();
      await expect(page.getByText(message)).toBeVisible({
        timeout: SCREEN_TIMEOUT,
      });
      const round = await roundOf(workspaceId);
      expect(round).toMatchObject({ status });
      expect(await previewFiles(round?.id ?? "")).toEqual([]);

      await tryAgain(page).click();
      await expect
        .poll(async () => (await roundOf(workspaceId, 1))?.attempt)
        .toBe(2);
      await removeRoundFiles((await roundsOf(workspaceId)).map((r) => r.id));
    });
  }

  test("the 20th round of the day is the last: the next start shows the limit message", async () => {
    const { page, uid } = a;
    const { workspaceId } = await seed();
    const now = new Date().toISOString();
    await insertRounds(
      uid,
      workspaceId,
      Array.from({ length: 20 }, (_, index) => ({
        n: 1,
        attempt: index + 1,
        status: "failed",
        started_at: now,
        running_at: now,
        finished_at: now,
      })),
    );
    await page.goto(`/w/${workspaceId}`);
    await tryAgain(page).click();
    await expect(page.getByText(DAILY_LIMIT)).toBeVisible();
    expect(await roundsOf(workspaceId)).toHaveLength(20);
  });

  test("a running round with no deadline for 60 seconds fails (the brief rewrite never finished)", async () => {
    const { page, uid } = a;
    const { workspaceId } = await seed();
    const started = new Date(Date.now() - 120_000).toISOString();
    await insertRounds(uid, workspaceId, [
      {
        n: 1,
        attempt: 1,
        status: "running",
        started_at: started,
        running_at: started,
      },
    ]);
    await page.goto(`/w/${workspaceId}`);
    await expect(page.getByText(FAILED)).toBeVisible();
    expect(await roundOf(workspaceId)).toMatchObject({
      status: "failed",
      error: "brief_rewrite_timeout",
    });
  });

  test("rounds that failed while queued don't count toward the daily limit", async () => {
    test.setTimeout(3 * SCREEN_TIMEOUT);
    const { page, uid } = a;
    const { workspaceId } = await seed();
    const now = new Date().toISOString();
    await insertRounds(
      uid,
      workspaceId,
      Array.from({ length: 25 }, (_, index) => ({
        n: 1,
        attempt: index + 1,
        status: "failed",
        error: "stale_queued",
        started_at: now,
        finished_at: now,
      })),
    );
    await page.goto(`/w/${workspaceId}`);
    await tryAgain(page).click();
    await expect(
      page.getByRole("heading", { name: "Round 1, attempt 26" }),
    ).toBeVisible();
    await expect(page.getByText(DAILY_LIMIT)).toHaveCount(0);
    await expect
      .poll(async () => (await roundOf(workspaceId, 25))?.status, {
        timeout: SCREEN_TIMEOUT,
      })
      .toBe("done");
  });

  test("a chat brief rule adds a brief version once the thread has a workspace", async () => {
    const { page } = a;
    const { workspaceId } = await seed();
    await page.goto(`/w/${workspaceId}`);
    await sendMessage(page, "Noted: brief rule: show it outdoors.");
    await expect
      .poll(async () => (await briefsOf(workspaceId)).map((b) => b.cause))
      .toEqual(["initial", "chat"]);
    await sendMessage(page, "Noted: brief rule: show it outdoors.");
    await expect(page.getByText("Nothing new to add.").first()).toBeVisible();
    expect(await briefsOf(workspaceId)).toHaveLength(2);
    const [, chat] = await briefsOf(workspaceId);
    expect(chat?.content).toMatchObject({
      rules: [
        { kind: "do", text: "Show it outdoors", source: "chat", locked: false },
      ],
    });
  });
});
