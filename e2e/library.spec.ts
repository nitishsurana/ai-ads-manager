// Runs against `next dev` with PROVIDERS=fake. One workspace gets two real fake rounds (round 2 starts from the rated round 1); their ratings, reasons and one edit are then written straight to the rows, so the Library has a mix to filter. The tests share that state, so the describe is serial.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import sharp from "sharp";
import { generate } from "./confirm-helpers";
import { FAKE_PROVIDERS, resetTesters, secret, testerContext } from "./helpers";
import { roundOf, SCREEN_TIMEOUT } from "./round-helpers";
import { seedWorkspace } from "./seed";

test.skip(!FAKE_PROVIDERS, "replays committed fixtures");
test.afterAll(resetTesters);
test.describe.configure({ mode: "serial" });

const section = (page: Page, n: number) =>
  page.getByRole("region", { name: `Round ${n}` });
const row = (page: Page, round: number, n: number) =>
  section(page, round).getByRole("article", { name: `Creative ${n}` });
const roundHeadings = (page: Page) => page.getByRole("heading", { level: 2 });

async function creativesOf(roundId: string) {
  const { data } = await secret
    .from("creatives")
    .select("id, n, copy")
    .eq("round_id", roundId)
    .order("n");
  return data ?? [];
}

async function rate(
  roundId: string,
  n: number,
  values: {
    rating?: "approve" | "reject";
    tags?: string[];
    note?: string;
    copy?: unknown;
    edits?: unknown;
  },
) {
  const { error } = await secret
    .from("creatives")
    .update(values as never)
    .eq("round_id", roundId)
    .eq("n", n);
  expect(error).toBeNull();
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

test.describe("library", () => {
  let a: Awaited<ReturnType<typeof testerContext>>;
  let workspaceId = "";
  const roundIds: string[] = [];
  const library = () => `/w/${workspaceId}/library`;

  test.beforeAll(async ({ browser }) => {
    a = await testerContext(browser, "a");
  });
  test.afterAll(async () => {
    await a?.context.close();
  });

  test("a workspace with no finished round shows an empty state linking back", async () => {
    const { page } = a;
    const seeded = await seedWorkspace({
      userId: a.uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    });
    workspaceId = seeded.workspaceId;
    await page.goto(library());
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(
      page.getByText("No finished rounds yet. Make a round"),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Filter by rating" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Back to the workspace" }).click();
    await expect(page).toHaveURL(`/w/${workspaceId}`);
  });

  test("two rounds are made and rated", async () => {
    test.setTimeout(5 * SCREEN_TIMEOUT);
    const { page } = a;
    await secret
      .from("workspaces")
      .update({ campaign: { occasion: "New season" } })
      .eq("id", workspaceId);
    await page.goto(`/w/${workspaceId}`);
    await generate(page).click();
    await expect
      .poll(async () => (await roundOf(workspaceId))?.status, {
        timeout: SCREEN_TIMEOUT,
      })
      .toBe("done");
    roundIds.push((await roundOf(workspaceId))?.id ?? "");

    const [first] = await creativesOf(roundIds[0] ?? "");
    const copy = first?.copy as {
      eyebrow: string;
      headline: string;
      cta: string;
    };
    await rate(roundIds[0] ?? "", 1, { rating: "approve", note: "Love it" });
    await rate(roundIds[0] ?? "", 2, { rating: "reject", tags: ["Colour"] });
    await rate(roundIds[0] ?? "", 3, {
      rating: "reject",
      note: "Too busy behind the product",
      copy: { ...copy, headline: "Fresh picks for you", cta: "Buy today" },
      edits: [
        {
          at: new Date().toISOString(),
          from: { headline: copy.headline, cta: copy.cta },
          to: { headline: "Fresh picks for you", cta: "Buy today" },
        },
      ],
    });

    await page.goto(`/w/${workspaceId}`);
    await page.getByRole("button", { name: "Next round" }).click();
    await expect
      .poll(async () => (await roundOf(workspaceId, 1))?.status, {
        timeout: SCREEN_TIMEOUT,
      })
      .toBe("done");
    roundIds.push((await roundOf(workspaceId, 1))?.id ?? "");
    await rate(roundIds[1] ?? "", 1, {
      rating: "approve",
      note: "The warm light feels festive",
    });
  });

  test("rounds show newest first with each creative's rating, reasons and edit", async () => {
    const { page } = a;
    await page.goto(library());
    await expect(roundHeadings(page)).toHaveText(["Round 2", "Round 1"]);
    await expect(page.getByText(/2 rounds · 6 creatives/)).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Workspace" }).getByRole("link", {
        name: "Library",
      }),
    ).toHaveAttribute("aria-current", "page");
    await expect(section(page, 2)).toContainText("brief v2");
    await expect(section(page, 1)).toContainText("brief v1");
    await expect(section(page, 1)).toContainText("1 approved · 2 rejected");
    await expect(section(page, 2)).toContainText("1 approved · 2 not rated");
    await expect(page.getByRole("article")).toHaveCount(6);

    const approved = row(page, 1, 1);
    await expect(approved).toContainText("Approved");
    await expect(approved).toContainText("Love it");
    await expect(approved).not.toContainText("Edited");

    const tagged = row(page, 1, 2);
    await expect(tagged).toContainText("Rejected");
    await expect(tagged.getByText("Colour", { exact: true })).toBeVisible();

    const edited = row(page, 1, 3);
    await expect(edited).toContainText("Rejected");
    await expect(edited).toContainText("Too busy behind the product");
    await expect(edited).toContainText("Edited · 1");
    await expect(edited).toContainText("Fresh picks for you");
    await expect(edited).toContainText("Buy today");

    await expect(row(page, 2, 2)).toContainText("Not rated yet");
    await expect(row(page, 2, 1)).toContainText("The warm light feels festive");
    for (const img of await page.getByRole("article").getByRole("img").all()) {
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    }
  });

  test("the rating filter narrows the list through the URL and hides empty rounds", async () => {
    const { page } = a;
    await page.goto(library());
    const filter = page.getByRole("navigation", { name: "Filter by rating" });

    await filter.getByRole("link", { name: "Rejected" }).click();
    await expect(page).toHaveURL(`${library()}?rating=rejected`);
    await expect(roundHeadings(page)).toHaveText(["Round 1"]);
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.getByText("Not rated yet")).toHaveCount(0);

    await filter.getByRole("link", { name: "Approved" }).click();
    await expect(roundHeadings(page)).toHaveText(["Round 2", "Round 1"]);
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(section(page, 1)).toContainText("1 approved");
    await expect(section(page, 1)).not.toContainText("rejected");

    await filter.getByRole("link", { name: "Not rated" }).click();
    await expect(page).toHaveURL(`${library()}?rating=unrated`);
    await expect(roundHeadings(page)).toHaveText(["Round 2"]);
    await expect(page.getByRole("article")).toHaveCount(2);

    await page.goto(`${library()}?rating=bogus`);
    await expect(page.getByRole("article")).toHaveCount(6);
    await expect(filter.getByRole("link", { name: "All" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.goto(`${library()}?rating=approved&rating=rejected`);
    await expect(page.getByRole("article")).toHaveCount(6);

    // Nothing matches once every creative is approved.
    await secret
      .from("creatives")
      .update({ rating: "approve" })
      .in("round_id", roundIds);
    await page.goto(`${library()}?rating=rejected`);
    await expect(
      page.getByText("No creatives match this filter."),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  test("a PNG and a round zip download at 1080x1920 under the round's file names", async () => {
    test.setTimeout(2 * SCREEN_TIMEOUT);
    const { page } = a;
    const round = await roundOf(workspaceId, 1);
    const inputs = round?.inputs as {
      productTitle: string;
      values: { brandName: string | null };
    };
    const base = [
      slug(inputs.values.brandName ?? ""),
      slug(inputs.productTitle),
      "r2",
    ].join("-");

    await page.goto(library());
    const pngDownload = page.waitForEvent("download");
    await row(page, 2, 1).getByRole("button", { name: "Download PNG" }).click();
    const png = await pngDownload;
    expect(png.suggestedFilename()).toMatch(
      new RegExp(`^${base}-c1(-[A-Z]{3})?\\.png$`),
    );
    const meta = await sharp(await readFile(await png.path())).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([1080, 1920, "png"]);

    await rate(roundIds[1] ?? "", 1, { rating: "reject", tags: ["Copy"] });
    await page.goto(`${library()}?rating=approved`);
    await expect(section(page, 2).getByRole("article")).toHaveCount(2);
    const zipDownload = page.waitForEvent("download");
    await section(page, 2)
      .getByRole("button", { name: "Download round as zip" })
      .click();
    const zipFile = await zipDownload;
    expect(zipFile.suggestedFilename()).toBe(`${base}.zip`);
    const zip = await JSZip.loadAsync(await readFile(await zipFile.path()));
    const names = Object.keys(zip.files).sort();
    expect(names).toHaveLength(3);
    names.forEach((name, i) =>
      expect(name).toMatch(new RegExp(`^${base}-c${i + 1}(-[A-Z]{3})?\\.png$`)),
    );
    for (const file of Object.values(zip.files)) {
      const size = await sharp(await file.async("nodebuffer")).metadata();
      expect([size.width, size.height]).toEqual([1080, 1920]);
    }
  });

  test("another tester's workspace and a missing one are 404", async ({
    browser,
  }) => {
    const b = await testerContext(browser, "b");
    for (const id of [workspaceId, "00000000-0000-4000-8000-000000000000"]) {
      const response = await b.page.goto(`/w/${id}/library`);
      expect(response?.status()).toBe(404);
    }
    await b.context.close();
  });
});
