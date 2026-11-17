// Runs against `next dev` with PROVIDERS=fake and the shortened timers of e2e/timers.ts. One workspace goes through the round view in order: round 1 is made, rated, edited, downloaded and given brief rules, then round 2 starts from it and its brief is rewritten. The tests share that state, so the describe is serial. The fake copy gives every creative the eyebrow "New season picks" and headlines of at most 5 words; with the campaign occasion "New season" it passes the campaign-tag check and is drawn uppercase (3 words), so the combined headline and eyebrow limit of 8 words is reachable.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import sharp from "sharp";
import { generate } from "./confirm-helpers";
import { FAKE_PROVIDERS, resetTesters, secret, testerContext } from "./helpers";
import {
  callsOf,
  previewFiles,
  roundOf,
  SCREEN_TIMEOUT,
} from "./round-helpers";
import { seedWorkspace } from "./seed";

test.skip(!FAKE_PROVIDERS, "replays committed fixtures");
test.afterAll(resetTesters);
test.describe.configure({ mode: "serial" });

const next = (page: Page) => page.getByRole("button", { name: "Next round" });
const card = (page: Page, n: number) => page.locator("article").nth(n - 1);

async function creativesOf(roundId: string) {
  const { data } = await secret
    .from("creatives")
    .select(
      "id, n, angle, rating, tags, note, rev, copy, layout, edits, preview_path, supporting_element",
    )
    .eq("round_id", roundId)
    .order("n");
  return data ?? [];
}

async function briefsOf(workspaceId: string) {
  const { data } = await secret
    .from("briefs")
    .select("version, cause, content")
    .eq("workspace_id", workspaceId)
    .order("version");
  return data ?? [];
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

test.describe("round view", () => {
  let a: Awaited<ReturnType<typeof testerContext>>;
  let workspaceId = "";
  let roundId = "";

  test.beforeAll(async ({ browser }) => {
    a = await testerContext(browser, "a");
  });
  test.afterAll(async () => {
    await a?.context.close();
  });

  test("round 1 shows its creatives as cards", async () => {
    test.setTimeout(3 * SCREEN_TIMEOUT);
    const { page } = a;
    ({ workspaceId } = await seedWorkspace({
      userId: a.uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    }));
    await secret
      .from("workspaces")
      .update({ campaign: { occasion: "New season" } })
      .eq("id", workspaceId);
    await page.goto(`/w/${workspaceId}`);
    await generate(page).click();
    await expect(page.getByText("Making your creatives")).toBeVisible();
    for (const label of [
      "Writing copy",
      "Making backgrounds",
      "Compositing",
      "Checking quality",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Round 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next round" })).toBeVisible({
      timeout: SCREEN_TIMEOUT,
    });
    roundId = (await roundOf(workspaceId))?.id ?? "";
    await expect(page.getByText(/^3 creatives · made in/)).toBeVisible();
    await expect(page.locator("article")).toHaveCount(3);
    await expect(next(page)).toBeDisabled();
    await expect(page.getByText("3 left to rate")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Round 0 in Library" }),
    ).toHaveCount(0);
    await expect(page.getByText("Round 1 · brief v1")).toBeVisible();
    await expect(page.getByLabel("Message")).toHaveAttribute(
      "placeholder",
      "Give direction for the next round…",
    );
  });

  test("a reject needs a tag or a note, and Next round waits for every rating", async ({
    browser,
  }) => {
    const { page } = a;
    const rows = await creativesOf(roundId);
    const first = rows[0];
    const approve = card(page, 1).getByRole("button", { name: "Approve" });

    const action = page.waitForRequest(
      (r) => r.method() === "POST" && "next-action" in r.headers(),
    );
    await approve.click();
    const actionId = (await action).headers()["next-action"] ?? "";
    await expect(approve).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("2 left to rate")).toBeVisible();
    await expect
      .poll(async () => (await creativesOf(roundId))[0]?.rating)
      .toBe("approve");

    // Reject alone is not a rating.
    await card(page, 2).getByRole("button", { name: "Reject" }).click();
    await expect(
      card(page, 2).getByText(
        "Pick a tag or add a note so the next round can improve.",
      ),
    ).toBeVisible();
    await expect(page.getByText("2 left to rate")).toBeVisible();
    await expect(next(page)).toBeDisabled();
    expect((await creativesOf(roundId))[1]?.rating).toBeNull();

    await card(page, 2).getByRole("button", { name: "Colour" }).click();
    await expect(page.getByText("1 left to rate")).toBeVisible();
    await expect
      .poll(async () => (await creativesOf(roundId))[1])
      .toMatchObject({ rating: "reject", tags: ["Colour"] });

    await card(page, 3).getByRole("button", { name: "Reject" }).click();
    await card(page, 3)
      .getByLabel("Reason for rejecting")
      .fill("Too busy behind the product");
    await expect(page.getByText("All 3 rated")).toBeVisible();
    await expect(next(page)).toBeEnabled();
    await expect
      .poll(async () => (await creativesOf(roundId))[2])
      .toMatchObject({
        rating: "reject",
        tags: [],
        note: "Too busy behind the product",
      });

    // A reload shows what was saved.
    await page.reload();
    await expect(
      card(page, 1).getByRole("button", { name: "Approve" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      card(page, 2).getByRole("button", { name: "Colour" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(card(page, 3).getByLabel("Reason for rejecting")).toHaveValue(
      "Too busy behind the product",
    );
    await expect(next(page)).toBeEnabled();

    // Another tester can't rate it, even with the action's id.
    const b = await testerContext(browser, "b");
    const response = await b.context.request.post("/", {
      headers: {
        "next-action": actionId,
        "content-type": "text/plain;charset=UTF-8",
      },
      data: JSON.stringify([
        {
          workspaceId,
          creativeId: first?.id,
          rev: first?.rev,
          rating: "reject",
          tags: ["Copy"],
          note: "",
        },
      ]),
    });
    expect(await response.text()).toContain("not_found");
    await b.context.close();
    expect((await creativesOf(roundId))[0]?.rating).toBe("approve");
  });

  test("an inline edit is checked against the limits and re-rendered", async () => {
    test.setTimeout(2 * SCREEN_TIMEOUT);
    const { page } = a;
    const before = (await creativesOf(roundId))[0];
    expect(before?.copy).toMatchObject({ eyebrow: "NEW SEASON PICKS" });
    const filesBefore = await previewFiles(roundId);

    await card(page, 1)
      .getByRole("button", { name: "Edit headline and CTA" })
      .click();
    await expect(page.getByText("Save or cancel your edit")).toBeVisible();
    await expect(next(page)).toBeDisabled();
    const save = card(page, 1).getByRole("button", { name: "Save text" });
    const headline = card(page, 1).getByLabel("Headline", { exact: true });
    const cta = card(page, 1).getByLabel("CTA", { exact: true });

    await headline.fill("one two three four five six seven");
    await expect(
      card(page, 1).getByText(
        "The headline is over 6 words. Shorten it to save.",
      ),
    ).toBeVisible();
    await expect(save).toBeDisabled();

    await headline.fill("a".repeat(76));
    await expect(
      card(page, 1).getByText(
        "The headline is over 75 characters. Shorten it to save.",
      ),
    ).toBeVisible();

    // Six words is within the headline limit, but with the 3-word eyebrow it passes 8.
    await headline.fill("one two three four five six");
    await expect(
      card(page, 1).getByText("Headline + eyebrow 9/8 words"),
    ).toBeVisible();
    await expect(
      card(page, 1).getByText(
        "The headline and eyebrow together are over 8 words. Shorten the headline to save.",
      ),
    ).toBeVisible();
    await expect(save).toBeDisabled();

    await headline.fill("Fresh picks for you");
    await cta.fill("one two three four");
    await expect(
      card(page, 1).getByText("The CTA is over 3 words. Shorten it to save."),
    ).toBeVisible();
    await cta.fill("");
    await expect(card(page, 1).getByText("Add a CTA to save.")).toBeVisible();

    // Layer 1 refuses text the fonts can't draw; nothing changes.
    await headline.fill("日本語");
    await cta.fill("Shop now");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(
      card(page, 1).getByText(
        "This edit can't be used: no font has U+65E5 of the headline",
      ),
    ).toBeVisible({ timeout: SCREEN_TIMEOUT });
    expect((await creativesOf(roundId))[0]).toMatchObject({
      rev: before?.rev,
      copy: before?.copy,
      preview_path: before?.preview_path,
    });
    expect(await previewFiles(roundId)).toEqual(filesBefore);

    // Copy that claims what isn't confirmed is refused too.
    await headline.fill("50% off today only");
    await cta.fill("Shop now");
    await save.click();
    await expect(
      card(page, 1).getByText(
        /This edit can't be used: .*isn't in the confirmed facts/,
      ),
    ).toBeVisible({ timeout: SCREEN_TIMEOUT });
    expect((await creativesOf(roundId))[0]?.rev).toBe(before?.rev);

    // Cancel leaves the creative as it was.
    await card(page, 1).getByRole("button", { name: "Cancel" }).click();
    await expect(next(page)).toBeEnabled();

    await card(page, 1)
      .getByRole("button", { name: "Edit headline and CTA" })
      .click();
    await headline.fill("Fresh picks for you");
    await cta.fill("Buy today");
    await save.click();
    await expect(
      card(page, 1).getByRole("img", { name: /Fresh picks for you/ }),
    ).toBeVisible({ timeout: SCREEN_TIMEOUT });
    await expect(page.getByText("All 3 rated")).toBeVisible();
    await expect
      .poll(() =>
        card(page, 1)
          .getByRole("img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);

    const after = (await creativesOf(roundId))[0];
    expect(after?.copy).toEqual({
      eyebrow: "NEW SEASON PICKS",
      headline: "Fresh picks for you",
      cta: "Buy today",
    });
    expect(after?.rev).toBeGreaterThan(before?.rev ?? 0);
    expect(after?.preview_path).not.toBe(before?.preview_path);
    expect(
      (after?.layout as { headline: { lines: string[] } }).headline.lines.join(
        " ",
      ),
    ).toBe("Fresh picks for you");
    expect(after?.edits).toEqual([
      {
        at: expect.any(String),
        from: {
          headline: (before?.copy as { headline: string }).headline,
          cta: "Shop now",
        },
        to: { headline: "Fresh picks for you", cta: "Buy today" },
      },
    ]);
    // The old preview file is gone, and the rating survived the edit.
    expect(await previewFiles(roundId)).toHaveLength(filesBefore.length);
    expect(after?.rating).toBe("approve");
  });

  test("a rating from a stale window is refused", async () => {
    const { page } = a;
    const row = (await creativesOf(roundId))[2];
    await secret
      .from("creatives")
      .update({ rev: (row?.rev ?? 0) + 10 })
      .eq("id", row?.id ?? "");
    await card(page, 3).getByRole("button", { name: "Approve" }).click();
    await expect(
      card(page, 3).getByText(
        "This creative changed in another window. Reload the page to see it.",
      ),
    ).toBeVisible();
    expect((await creativesOf(roundId))[2]?.rating).toBe("reject");

    // An edit from the same stale window is refused before anything is checked.
    await card(page, 3)
      .getByRole("button", { name: "Edit headline and CTA" })
      .click();
    await card(page, 3)
      .getByLabel("Headline", { exact: true })
      .fill("Quiet kitchen picks");
    await card(page, 3).getByRole("button", { name: "Save text" }).click();
    await expect(
      card(page, 3).getByText(
        "This creative changed in another window. Reload the page to see it.",
      ),
    ).toHaveCount(2);
    expect((await creativesOf(roundId))[2]?.copy).toMatchObject({
      headline: expect.not.stringContaining("Quiet kitchen"),
    });
    await page.reload();
    await expect(
      card(page, 3).getByRole("button", { name: "Reject" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("a PNG downloads at 1080x1920 under its file name, with the currency only when a price shows", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(2 * SCREEN_TIMEOUT);
    const { page } = a;
    const round = await roundOf(workspaceId);
    const inputs = round?.inputs as {
      productTitle: string;
      values: { brandName: string | null; currency: string };
    };
    const rows = await creativesOf(roundId);
    const names: string[] = [];
    for (const row of rows) {
      const download = page.waitForEvent("download");
      await card(page, row.n).getByRole("button", { name: "PNG" }).click();
      const file = await download;
      const shown =
        (row.layout as { badge: { kind: string } | null }).badge?.kind ===
        "price";
      const expected = [
        slug(inputs.values.brandName ?? ""),
        slug(inputs.productTitle),
        "r1",
        `c${row.n}`,
        ...(shown ? [inputs.values.currency] : []),
      ].join("-");
      expect(file.suggestedFilename()).toBe(`${expected}.png`);
      names.push(file.suggestedFilename());
      const path = await file.path();
      const meta = await sharp(await readFile(path)).metadata();
      expect([meta.width, meta.height, meta.format]).toEqual([
        1080,
        1920,
        "png",
      ]);
    }
    expect(
      names.some((name) => name.includes(`-${inputs.values.currency}.`)),
    ).toBe(true);
    expect(
      names.some((name) => !name.includes(`-${inputs.values.currency}.`)),
    ).toBe(true);

    const { data: exported } = await secret.storage.from("exports").list(a.uid);
    expect(exported?.length).toBe(rows.length);

    // Only the owner can ask for one.
    const id = rows[0]?.id ?? "";
    const b = await testerContext(browser, "b");
    expect(
      (await b.context.request.get(`/api/creatives/${id}/export`)).status(),
    ).toBe(404);
    await b.context.close();
    const anonymous = await browser.newContext({ baseURL });
    expect(
      (await anonymous.request.get(`/api/creatives/${id}/export`)).status(),
    ).toBe(401);
    await anonymous.close();

    // The zip holds the round's files, built in the browser from the same names.
    const zipDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download all as zip" }).click();
    const zipFile = await zipDownload;
    expect(zipFile.suggestedFilename()).toBe(
      `${names[0]?.replace(/-c\d+(-[A-Z]{3})?\.png$/, "")}.zip`,
    );
    const zip = await JSZip.loadAsync(await readFile(await zipFile.path()));
    expect(Object.keys(zip.files).sort()).toEqual([...names].sort());
    for (const file of Object.values(zip.files)) {
      const meta = await sharp(await file.async("nodebuffer")).metadata();
      expect([meta.width, meta.height]).toEqual([1080, 1920]);
    }
  });

  test("tester brief edits are locked rules with a source label and a new version", async () => {
    const { page } = a;
    await page.getByRole("button", { name: /Creative brief/ }).click();
    await expect(page.getByLabel("Brief versions")).toContainText(
      "v1 · Initial",
    );

    await page
      .getByLabel("Add a Do rule")
      .fill("Always show the product outdoors");
    await page.getByLabel("Add a Do rule").press("Enter");
    const rule = page.getByText("Always show the product outdoors");
    await expect(rule).toBeVisible();
    await expect(page.getByLabel("Brief versions")).toContainText(
      "v2 · Your edit",
    );
    await page.getByLabel("Add a Don’t rule").fill("Use sale-style badges");
    await page.getByLabel("Add a Don’t rule").press("Enter");
    await expect(page.getByText("Use sale-style badges")).toBeVisible();
    await expect(page.getByLabel("Brief versions")).toContainText(
      "v3 · Your edit",
    );

    const briefs = await briefsOf(workspaceId);
    expect(briefs.map((b) => [b.version, b.cause])).toEqual([
      [1, "initial"],
      [2, "tester_edit"],
      [3, "tester_edit"],
    ]);
    expect(briefs[2]?.content).toMatchObject({
      rules: [
        {
          kind: "do",
          text: "Always show the product outdoors",
          source: "tester_edit",
          locked: true,
        },
        {
          kind: "dont",
          text: "Use sale-style badges",
          source: "tester_edit",
          locked: true,
        },
      ],
    });
    await expect(
      page.getByLabel("Locked: kept as written in later rounds").first(),
    ).toBeVisible();
  });

  test("Next round rewrites the brief keeping locked rules and records the approved angles", async () => {
    test.setTimeout(3 * SCREEN_TIMEOUT);
    const { page } = a;
    const rows = await creativesOf(roundId);
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Round 2" })).toBeVisible();
    await expect(page.getByText("Round 1 · 3 rated")).toBeVisible();
    await expect(page.getByText("Creative 1")).toBeVisible();
    await expect(page.getByText("Round 2 · making")).toBeVisible();

    await expect
      .poll(async () => (await roundOf(workspaceId, 1))?.status, {
        timeout: SCREEN_TIMEOUT,
      })
      .toBe("done");
    await expect(page.getByText(/^3 creatives · made in/)).toBeVisible();
    await expect(page.getByText("Round 2 · brief v4")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Round 1 in Library" }),
    ).toBeVisible();

    const round = await roundOf(workspaceId, 1);
    expect(round).toMatchObject({ n: 2, attempt: 1, brief_version: 4 });
    const briefs = await briefsOf(workspaceId);
    expect(briefs.map((b) => b.cause)).toEqual([
      "initial",
      "tester_edit",
      "tester_edit",
      "round",
    ]);
    const content = briefs[3]?.content as {
      rules: { kind: string; text: string; source: string; locked: boolean }[];
      approvedAngles: string[];
      exemplarCreativeIds: string[];
      round: number;
    };
    // Locked rules come through word for word; the model's rules are new, unlocked and sourced to the round.
    expect(content.rules).toEqual([
      expect.objectContaining({
        kind: "do",
        text: "Always show the product outdoors",
        source: "tester_edit",
        locked: true,
      }),
      expect.objectContaining({
        kind: "dont",
        text: "Use sale-style badges",
        source: "tester_edit",
        locked: true,
      }),
      expect.objectContaining({
        kind: "do",
        text: "Keep headlines short and calm",
        source: "round",
        locked: false,
      }),
      expect.objectContaining({
        kind: "dont",
        text: "Fill the background with orange",
        source: "round",
        locked: false,
      }),
    ]);
    expect(content.round).toBe(2);
    expect(content.approvedAngles).toEqual([rows[0]?.angle]);
    expect(content.exemplarCreativeIds).toEqual([rows[0]?.id]);
    await expect.poll(() => callsOf(round?.id ?? "", "brief_rewrite")).toBe(1);
  });
});
