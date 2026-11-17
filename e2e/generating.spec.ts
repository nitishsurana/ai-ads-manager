// The Generating screen in each state of its round, with rounds inserted straight into the database (the flows that start a round, retry and time out run in rounds.spec.ts). Runs against `next dev` with PROVIDERS=fake.
import { expect, test, type Page } from "@playwright/test";
import { FAKE_PROVIDERS, resetTesters, secret, testerContext } from "./helpers";
import { insertRounds, tryAgain } from "./round-helpers";
import { seedWorkspace } from "./seed";

const TIMED_OUT = "This is taking too long. You can retry in 5 minutes.";
const FAILED = "Something went wrong making this round. Try again.";
const NO_PASS =
  "We couldn't make creatives that pass our checks this time. Add more detail or update what you told us, then try again.";

test.skip(!FAKE_PROVIDERS, "replays committed fixtures");
test.afterAll(resetTesters);
test.describe.configure({ mode: "serial" });

const ANGLES = [
  "benefit",
  "social_proof",
  "offer",
  "lifestyle",
  "price",
  "feature_close_up",
];

const progress = (counts: Record<string, [number, number]>) => ({
  candidates: ANGLES.map((angle, index) => ({ n: index + 1, angle })),
  counts: Object.fromEntries(
    Object.entries(counts).map(([stage, [done, total]]) => [
      stage,
      { done, total },
    ]),
  ),
});

const tile = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator("../..");

const secondsAgo = (seconds: number) =>
  new Date(Date.now() - seconds * 1000).toISOString();

test.describe("generating screen", () => {
  let a: Awaited<ReturnType<typeof testerContext>>;

  test.beforeAll(async ({ browser }) => {
    a = await testerContext(browser, "a");
  });
  test.afterAll(async () => {
    await a?.context.close();
  });

  async function open(round: Record<string, unknown>) {
    const { workspaceId } = await seedWorkspace({
      userId: a.uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    });
    await insertRounds(a.uid, workspaceId, [
      {
        n: 1,
        attempt: 1,
        inputs: { campaign: { occasion: "Diwali", audience: "Young adults" } },
        ...round,
      },
    ]);
    await a.page.goto(`/w/${workspaceId}`);
    return workspaceId;
  }

  test("a running round shows its four stages with counts and the first three planned angles", async () => {
    const { page } = a;
    await open({
      status: "running",
      stage: "making_backgrounds",
      started_at: secondsAgo(104),
      running_at: secondsAgo(104),
      deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
      progress: progress({
        writing_copy: [6, 6],
        making_backgrounds: [4, 6],
        compositing: [0, 6],
        checking_quality: [0, 6],
      }),
    });

    await expect(page.getByRole("heading", { name: "Round 1" })).toBeVisible();
    await expect(
      page.getByText("Up to 3 creatives · Diwali · Young adults"),
    ).toBeVisible();
    await expect(page.getByText("Making your creatives")).toBeVisible();
    await expect(
      page.getByText(/^1 min \d+ s so far · usually under 3 min$/),
    ).toBeVisible();
    // The first stage is done, the second is at 4 of 6, the third is next.
    await expect(tile(page, "Writing copy")).toHaveText(
      /Writing copy6 headlines and CTAsDone/,
    );
    await expect(tile(page, "Making backgrounds")).toHaveText(
      /Making backgrounds4 of 6In progress/,
    );
    await expect(tile(page, "Compositing")).toHaveText(
      /CompositingNextNot started/,
    );
    await expect(tile(page, "Checking quality")).toHaveText(
      /Checking qualityNot startedNot started/,
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    // Three skeleton tiles carry the first three planned angles.
    await expect(page.getByText(/^Creative \d$/)).toHaveCount(3);
    for (const angle of ["Benefit", "Social proof", "Offer"]) {
      await expect(page.getByText(angle, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Lifestyle", { exact: true })).toHaveCount(0);
    await expect(tryAgain(page)).toHaveCount(0);
    await secret.from("rounds").delete().eq("user_id", a.uid);
  });

  test("a timed-out round marks the stage it stopped at and counts down to the retry", async () => {
    const { page } = a;
    const now = new Date().toISOString();
    await open({
      status: "timed_out",
      stage: "compositing",
      started_at: secondsAgo(190),
      running_at: secondsAgo(190),
      deadline_at: now,
      finished_at: now,
      progress: progress({
        writing_copy: [6, 6],
        making_backgrounds: [6, 6],
        compositing: [2, 6],
        checking_quality: [0, 6],
      }),
    });

    await expect(page.getByText(TIMED_OUT)).toBeVisible();
    await expect(
      page.getByText(
        "Your confirmed details and brief are saved. Retrying starts round 1 again.",
      ),
    ).toBeVisible();
    await expect(tile(page, "Compositing")).toHaveText(
      /CompositingStopped at 2 of 6Failed/,
    );
    await expect(page.getByText("Making your creatives")).toHaveCount(0);
    await expect(tryAgain(page)).toBeDisabled();
    await expect(tryAgain(page)).toHaveText(/^Retry in \d:\d\d$/);
    await expect(tryAgain(page)).toHaveText("Retry now", { timeout: 20_000 });
    await expect(tryAgain(page)).toBeEnabled();
    await secret.from("rounds").delete().eq("user_id", a.uid);
  });

  for (const [status, message] of [
    ["no_pass", NO_PASS],
    ["failed", FAILED],
  ] as const) {
    test(`a ${status} round shows its message and retries at once`, async () => {
      const { page } = a;
      const now = new Date().toISOString();
      await open({
        status,
        stage: "checking_quality",
        started_at: secondsAgo(60),
        running_at: secondsAgo(60),
        finished_at: now,
        progress: progress({
          writing_copy: [6, 6],
          making_backgrounds: [6, 6],
          compositing: [6, 6],
          checking_quality: [3, 6],
        }),
      });

      await expect(page.getByText(message)).toBeVisible();
      await expect(tryAgain(page)).toHaveText("Try again");
      await expect(tryAgain(page)).toBeEnabled();
      if (status === "no_pass") {
        // Nothing passed, so nothing is waiting to be shown.
        for (const label of [
          "Writing copy",
          "Making backgrounds",
          "Compositing",
          "Checking quality",
        ]) {
          await expect(tile(page, label)).toContainText("Done");
        }
        await expect(page.getByText(/^Creative \d$/)).toHaveCount(0);
      } else {
        await expect(tile(page, "Checking quality")).toHaveText(
          /Checking qualityStopped at 3 of 6Failed/,
        );
      }
      await secret.from("rounds").delete().eq("user_id", a.uid);
    });
  }
});
