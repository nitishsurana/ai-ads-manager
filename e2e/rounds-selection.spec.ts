// Runs against `next dev` with PROVIDERS=fake: the selection edge cases of a round, reached through the scripted judges' scores and the scripted Fal (see lib/round/fake.ts and the header of rounds.spec.ts). Each test seeds a workspace whose only badge element is the price and runs one round of one scenario.
import { expect, test } from "@playwright/test";
import { FAKE_PROVIDERS, resetTesters, testerContext } from "./helpers";
import {
  callsOf,
  judgedCreatives,
  previewFiles,
  runScenario,
  SCREEN_TIMEOUT,
} from "./round-helpers";
import { seedWorkspace } from "./seed";

test.skip(!FAKE_PROVIDERS, "replays committed fixtures");
test.afterAll(resetTesters);
test.describe.configure({ mode: "serial" });

test.describe("round selection", () => {
  let a: Awaited<ReturnType<typeof testerContext>>;

  test.beforeAll(async ({ browser }) => {
    a = await testerContext(browser, "a");
  });
  test.afterAll(async () => {
    await a?.context.close();
  });

  const seed = () =>
    seedWorkspace({
      userId: a.uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    });

  test("a Layer 1 failure regenerates its candidate inside the deadline and the round still shows three", async () => {
    test.setTimeout(3 * SCREEN_TIMEOUT);
    const { roundId } = await runScenario(a.page, "l1_fail", seed);
    expect(await judgedCreatives(roundId)).toHaveLength(3);
    // The framed background is refused by Layer 1 and made again.
    expect(await callsOf(roundId, "background")).toBe(7);
    expect(await callsOf(roundId, "judge")).toBe(3);
    expect(await previewFiles(roundId)).toHaveLength(3);
  });

  test("fewer than three passing the judges shows only those", async () => {
    test.setTimeout(3 * SCREEN_TIMEOUT);
    const { roundId } = await runScenario(a.page, "two_pass", seed);
    const creatives = await judgedCreatives(roundId);
    expect(creatives).toHaveLength(2);
    expect(creatives.every((creative) => creative.judge?.pass)).toBe(true);
    await expect(a.page.getByText("2 creatives ready")).toBeVisible();
    expect(await previewFiles(roundId)).toHaveLength(2);
  });

  test("when no passing candidate carries the price badge, one covering attempt is made and the best set is shown", async () => {
    test.setTimeout(3 * SCREEN_TIMEOUT);
    const { roundId } = await runScenario(a.page, "no_cover", seed);
    const creatives = await judgedCreatives(roundId);
    expect(creatives).toHaveLength(3);
    expect(creatives.some((c) => c.supporting_element === "price")).toBe(false);
    // A lower-ranked candidate was given the badge, checked, and the panel ran again.
    expect(await callsOf(roundId, "judge")).toBe(6);
    expect(await callsOf(roundId, "background")).toBe(6);
  });

  test("a covering swap that the judges accept puts a price creative in the shown set", async () => {
    test.setTimeout(3 * SCREEN_TIMEOUT);
    const { roundId } = await runScenario(a.page, "swap", seed);
    const creatives = await judgedCreatives(roundId);
    expect(creatives).toHaveLength(3);
    expect(creatives.some((c) => c.supporting_element === "price")).toBe(true);
    expect(creatives.every((c) => c.judge?.pass)).toBe(true);
    // The swap meant a second panel, and no new background.
    expect(await callsOf(roundId, "judge")).toBe(6);
    expect(await callsOf(roundId, "background")).toBe(6);
  });

  test("judges two points apart flag the creatives as low confidence, and the creatives still show", async () => {
    test.setTimeout(3 * SCREEN_TIMEOUT);
    const { roundId } = await runScenario(a.page, "low_confidence", seed);
    const creatives = await judgedCreatives(roundId);
    expect(creatives).toHaveLength(3);
    expect(creatives.every((c) => c.judge?.pass && c.judge.lowConfidence)).toBe(
      true,
    );
  });
});
