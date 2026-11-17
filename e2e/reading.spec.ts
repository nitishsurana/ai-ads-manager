// Runs against `next dev` with PROVIDERS=fake (the Playwright config sets it, with a shortened INTAKE_STALE_S): intakes replay golden/fixtures.
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import type { ProgressState } from "../lib/intake/workflow/types";
import { resetTesters, secret, sendMessage, testerContext } from "./helpers";

const SUCCESS_URL = "https://shopabc.myshopify.com/products/blue-mug";
const FAILING_URL = "https://plain.example/products/blue-mug";
const NAVIGATE_TIMEOUT = 30_000;
const SCREEN_TIMEOUT = 60_000;

// Each test starts with the testers' threads empty, as the third one counts them.
test.afterEach(resetTesters);

async function startIntake(
  page: Awaited<ReturnType<typeof testerContext>>["page"],
  url: string,
) {
  await sendMessage(page, url);
  await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/, {
    timeout: NAVIGATE_TIMEOUT,
  });
}

test("a readable product ends on its workspace", async ({ browser }) => {
  const { context, page } = await testerContext(browser, "a");
  await startIntake(page, SUCCESS_URL);
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/, {
    timeout: SCREEN_TIMEOUT,
  });
  await context.close();
});

test("an unreadable product shows the failure with its exact message", async ({
  browser,
}) => {
  const { context, page } = await testerContext(browser, "a");
  await startIntake(page, FAILING_URL);

  await expect(
    page.getByRole("heading", { name: "We couldn’t read this product" }),
  ).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(
    page
      .getByRole("main")
      .getByRole("alert")
      .filter({ hasText: "Only Shopify product pages are supported for now." }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("log", { name: "Conversation" })
      .getByText("Only Shopify product pages are supported for now."),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Try another link" }).click();
  await expect(page.getByLabel("Message")).toBeFocused();
  await context.close();
});

test("the reading screen follows progress and the stuck rule, and only its owner can poll it", async ({
  browser,
}) => {
  const owner = await testerContext(browser, "a");
  const { page } = owner;
  const { data: thread } = await secret
    .from("threads")
    .select("id")
    .eq("user_id", owner.uid)
    .single();
  const { data: intake } = await secret
    .from("intakes")
    .insert({
      user_id: owner.uid,
      thread_id: thread?.id ?? "",
      url: SUCCESS_URL,
    })
    .select("id")
    .single();
  const id = intake?.id ?? "";

  await page.goto(`/r/${id}`);
  await expect(
    page.getByRole("heading", { name: "Reading the product" }),
  ).toBeVisible();
  await expect(page.getByText(SUCCESS_URL, { exact: true })).toBeVisible();
  for (const label of [
    "Checking the link",
    "Reading the product",
    "Collecting photos",
    "Building the brand kit",
  ]) {
    await expect(
      page.locator("section").getByText(label, { exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByText("Photos so far")).toBeVisible();

  const other = await testerContext(browser, "b");
  expect((await other.page.request.get(`/api/intakes/${id}`)).status()).toBe(
    404,
  );
  expect((await page.request.get(`/api/intakes/${id}`)).status()).toBe(200);

  const thumbPath = `${id}/1-thumb.jpg`;
  const thumb = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#888" },
  })
    .jpeg()
    .toBuffer();
  await secret.storage
    .from("photos")
    .upload(thumbPath, thumb, { contentType: "image/jpeg" });
  await secret
    .from("intakes")
    .update({
      progress: {
        stage: "photos",
        phase: "checking",
        done: 2,
        total: 5,
        product: { title: "Blue Mug", price: "$24.00" },
        photos: [{ position: 1, thumbPath }],
      } satisfies ProgressState,
    })
    .eq("id", id);
  await expect(page.getByText("Blue Mug · $24.00")).toBeVisible();
  await expect(page.getByText("2 of 5 checked")).toBeVisible({
    timeout: 15_000,
  });
  const photo = page.getByRole("img", { name: "Product photo 1" });
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  await secret
    .from("intakes")
    .update({ progress_at: new Date(Date.now() - 10 * 60_000).toISOString() })
    .eq("id", id);
  await expect(
    page.getByRole("main").getByRole("alert").filter({
      hasText: "Something went wrong reading this product. Try again.",
    }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page
      .getByRole("log", { name: "Conversation" })
      .getByText("Something went wrong reading this product. Try again."),
  ).toBeVisible();

  await owner.context.close();
  await other.context.close();
});
