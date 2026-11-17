// Runs against `next dev` with PROVIDERS=fake. Workspaces are seeded from committed fixtures (see seed.ts) for the states the chat can't reach, and a few are edited in the database to set up a case.
import { expect, test } from "@playwright/test";
import { productKeyOf } from "../lib/intake/product-key";
import {
  generate,
  nextAction,
  photoSelected,
  workspaceRow,
} from "./confirm-helpers";
import {
  resetTesters,
  FAKE_PROVIDERS,
  secret,
  sendMessage,
  testerContext,
} from "./helpers";
import { seedWorkspace } from "./seed";

const EXISTING_URL = "https://mugs.example/products/blue-mug?utm_source=email";
const SCREEN_TIMEOUT = 60_000;
const SAVE_FAILED = "We couldn't save that. Try again.";

test.skip(!FAKE_PROVIDERS, "replays committed fixtures");
test.afterAll(resetTesters);
test.describe.configure({ mode: "serial" });

test.describe("confirm states", () => {
  let a: Awaited<ReturnType<typeof testerContext>>;

  test.beforeAll(async ({ browser }) => {
    a = await testerContext(browser, "a");
  });
  test.afterAll(async () => {
    await a?.context.close();
  });

  test("a not-purchasable product blocks Generate until Continue", async () => {
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "quick-checkout-disabled",
    });
    await page.goto(`/w/${seeded.workspaceId}`);
    await expect(
      page.getByText(
        "Shoppers can't buy this online right now. Continue anyway?",
      ),
    ).toBeVisible();
    await expect(generate(page)).toBeDisabled();
    await expect(
      page.getByText("Answer the purchase flag at the top to continue."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Continue anyway" }).click();
    await expect(generate(page)).toBeEnabled();
    await expect(page.getByText("Continuing anyway")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(generate(page)).toBeDisabled();
  });

  test("a variant choice blocks Generate until a variant is chosen and confirmed", async () => {
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "choose-option-inconclusive",
    });
    await page.goto(`/w/${seeded.workspaceId}`);
    await expect(page.getByText("Choose a variant to continue.")).toBeVisible();
    await expect(generate(page)).toBeDisabled();

    await page.getByRole("combobox", { name: "Variant" }).click();
    await page
      .getByRole("option", { name: /availability unknown/ })
      .first()
      .click();
    await expect(
      page.getByText("Confirm the variant at the top to continue."),
    ).toBeVisible();
    await expect(generate(page)).toBeDisabled();

    await page.getByRole("button", { name: "Use this variant" }).click();
    await expect(generate(page)).toBeEnabled();
    await expect
      .poll(async () => (await workspaceRow(seeded.workspaceId))?.confirmed)
      .toMatchObject({ variantConfirmed: true });
  });

  test("a store with no logo and a blank brand name shows the no-logo warning", async () => {
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "brand-name-missing",
      brandPages: true,
    });
    await page.goto(`/w/${seeded.workspaceId}`);
    const warning = page.getByText(
      "We couldn't find a logo for this store, so these ads won't include one.",
    );
    const name = page.getByLabel("Brand name");
    await expect(name).toHaveValue("");
    await expect(warning).toHaveCount(0);

    await name.focus();
    await name.blur();
    await expect(warning).toBeVisible();
    await expect(page.getByText("1 thing to check")).toBeVisible();

    await name.fill("Mug Works");
    await name.blur();
    await expect(warning).toHaveCount(0);
    await page.getByRole("button", { name: "No brand name" }).click();
    await expect(warning).toBeVisible();
  });

  test("a logo with a missing store name shows both the logo and the name field", async () => {
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "brand-logo-with-default-name",
      brandPages: true,
    });
    await page.goto(`/w/${seeded.workspaceId}`);
    await expect(
      page.locator("#brand").getByText("Logo", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Brand name")).toBeVisible();
    await page.getByLabel("Brand name").focus();
    await page.getByLabel("Brand name").blur();
    await expect(page.getByText("We couldn't find a logo")).toHaveCount(0);
  });

  test("a product page with a rating and flagged photos shows them", async () => {
    const { page, uid } = a;
    const rated = await seedWorkspace({
      userId: uid,
      fixture: "rating-widget-own-section",
    });
    await page.goto(`/w/${rated.workspaceId}`);
    await expect(page.getByText("4.6 stars, 48 reviews")).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Show rating" }),
    ).toBeChecked();
    await page.getByRole("switch", { name: "Show rating" }).click();
    await expect(page.getByText("rating off")).toBeVisible();

    const flagged = await seedWorkspace({
      userId: uid,
      fixture: "photos-text-disagreement",
    });
    await page.goto(`/w/${flagged.workspaceId}`);
    await expect(
      page.getByText(
        "1 photo has added text. Photos without text are used first.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("1 photo is low resolution and may look soft."),
    ).toBeVisible();
    await expect(
      page.getByText(
        "This photo has text on it; photos without text are used first.",
      ),
    ).toBeVisible();
    await expect(page.getByText("3 of 3 selected")).toBeVisible();
  });

  test("edit mode saves without a round, and step 1 links to it", async () => {
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    });
    const url = `/w/${seeded.workspaceId}`;
    await page.goto(`${url}/confirm`);
    await expect(page).toHaveURL(url);

    await secret
      .from("workspaces")
      .update({ phase: "rounds" })
      .eq("id", seeded.workspaceId);
    await page.goto(url);
    await page.getByRole("link", { name: "Confirm" }).click();
    await expect(page).toHaveURL(`${url}/confirm`);
    await expect(
      page.getByText("Changes apply from your next round."),
    ).toHaveCount(2);
    await expect(generate(page)).toHaveCount(0);

    await page.getByLabel("Angle").fill("Housewarming");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(url);
    await expect
      .poll(async () => (await workspaceRow(seeded.workspaceId))?.campaign)
      .toMatchObject({ angle: "Housewarming" });

    await page.getByRole("link", { name: "Confirm" }).click();
    await expect(page.getByLabel("Angle")).toHaveValue("Housewarming");
    await page.getByRole("checkbox", { name: /^Use photo 1/ }).uncheck();
    await expect(
      page.getByRole("button", { name: "Save changes" }),
    ).toBeDisabled();
  });

  test("a new intake that resolves to this workspace brings its facts and campaign along", async () => {
    test.setTimeout(2 * SCREEN_TIMEOUT);
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "brand-name-header-text",
      brandPages: true,
      productKey: productKeyOf(new URL(EXISTING_URL)) ?? undefined,
    });
    await page.goto(`/w/${seeded.workspaceId}`);
    await sendMessage(
      page,
      `Mother's Day for new moms. 15% off this week. ${EXISTING_URL}`,
    );
    await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/, {
      timeout: SCREEN_TIMEOUT,
    });
    await expect(page).toHaveURL(`/w/${seeded.workspaceId}`, {
      timeout: SCREEN_TIMEOUT,
    });

    const chat = page.getByRole("log", { name: "Conversation" });
    // The turn that carried the link may still be recording its facts when the redirect lands.
    await expect(async () => {
      await page.reload();
      await expect(chat.getByText(/You also mentioned a campaign/)).toBeVisible(
        { timeout: 1_000 },
      );
    }).toPass({ timeout: 30_000 });
    await expect(chat.getByText(/Occasion: Mother's Day/)).toBeVisible();
    await expect(
      page.locator("#facts").getByText("15% off this week"),
    ).toBeVisible();
    await expect(page.getByLabel("Occasion")).toHaveValue("");
    expect((await workspaceRow(seeded.workspaceId))?.campaign).toEqual({});
  });

  test("a product with no page price can show a price once one is typed", async () => {
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    });
    const row = await workspaceRow(seeded.workspaceId);
    const product = row?.product as { page: Record<string, unknown> };
    product.page.price = null;
    product.page.priceAmount = null;
    await secret
      .from("workspaces")
      .update({ product })
      .eq("id", seeded.workspaceId);

    await page.goto(`/w/${seeded.workspaceId}`);
    const price = page.getByRole("textbox", { name: "Price", exact: true });
    await expect(price).toHaveValue("");
    await expect(
      page.getByText("Enter a price, or turn off Show price, to continue."),
    ).toBeVisible();
    await expect(generate(page)).toBeDisabled();

    await page.getByRole("switch", { name: "Show price" }).click();
    await expect(generate(page)).toBeEnabled();
    await expect(page.getByText("Price won’t appear in ads.")).toBeVisible();
    await page.getByRole("switch", { name: "Show price" }).click();
    await expect(generate(page)).toBeDisabled();

    await price.fill("12");
    await price.blur();
    await expect(page.getByText("$12.00", { exact: true })).toBeVisible();
    await expect(generate(page)).toBeEnabled();
    await expect
      .poll(async () => (await workspaceRow(seeded.workspaceId))?.confirmed)
      .toMatchObject({ showPrice: true, price: "$12.00" });
    await page.reload();
    await expect(price).toHaveValue("12.00");
    await expect(generate(page)).toBeEnabled();

    await price.fill("");
    await price.blur();
    await expect(generate(page)).toBeDisabled();
    await expect(
      page.getByText("Enter a price, or turn off Show price, to continue."),
    ).toBeVisible();
  });

  test("a blank brand name answer is kept after a reload", async () => {
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "brand-name-missing",
      brandPages: true,
    });
    await page.goto(`/w/${seeded.workspaceId}`);
    await page.getByRole("button", { name: "No brand name" }).click();
    await expect
      .poll(async () => (await workspaceRow(seeded.workspaceId))?.confirmed)
      .toMatchObject({ brandName: { answered: true, value: "" } });
    await page.reload();
    await expect(
      page.getByText(
        "We couldn't find a logo for this store, so these ads won't include one.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Brand name")).toHaveValue("");
  });

  test("Generate is refused when the saved answers are blocked, even on a replayed request", async () => {
    const { page, uid } = a;
    const good = await seedWorkspace({
      userId: uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    });
    const blocked = await seedWorkspace({
      userId: uid,
      fixture: "quick-checkout-disabled",
    });
    await page.goto(`/w/${good.workspaceId}`);
    const request = nextAction(page);
    await generate(page).click();
    const sent = await request;

    const replay = await page
      .context()
      .request.post(`/w/${blocked.workspaceId}`, {
        headers: {
          "next-action": sent.headers()["next-action"] ?? "",
          "content-type": "text/plain;charset=UTF-8",
        },
        data: (sent.postData() ?? "").replace(
          good.workspaceId,
          blocked.workspaceId,
        ),
      });
    expect(await replay.text()).toContain("cannot_generate");
    expect((await workspaceRow(blocked.workspaceId))?.confirmed).toBeNull();
  });

  test("saves sent at the same time both land", async () => {
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    });
    await page.goto(`/w/${seeded.workspaceId}`);
    const request = nextAction(page);
    await page.getByRole("checkbox", { name: /^Use photo 1/ }).uncheck();
    const sent = await request;
    await expect.poll(() => photoSelected(seeded.workspaceId)).toEqual([false]);

    const post = (answers: object) =>
      page.context().request.post(`/w/${seeded.workspaceId}`, {
        headers: {
          "next-action": sent.headers()["next-action"] ?? "",
          "content-type": "text/plain;charset=UTF-8",
        },
        data: JSON.stringify([seeded.workspaceId, answers]),
      });
    const results = await Promise.all([
      post({ brandKit: { audience: "Concurrent audience" } }),
      post({ brandKit: { tone: ["one", "two", "three"] } }),
    ]);
    for (const result of results) {
      expect(await result.text()).not.toContain("save_failed");
    }
    const saved = await workspaceRow(seeded.workspaceId);
    expect(saved?.brand_kit).toMatchObject({
      audience: "Concurrent audience",
      tone: ["one", "two", "three"],
    });
  });

  test("a save that fails shows its message and the screen resyncs with the saved state", async () => {
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    });
    await page.goto(`/w/${seeded.workspaceId}`);
    const tile = page.getByRole("checkbox", { name: /^Use photo 1/ });
    await expect(tile).toBeChecked();

    await page.route("**/w/**", (route) =>
      "next-action" in route.request().headers()
        ? route.abort()
        : route.continue(),
    );
    await tile.uncheck();
    await expect(page.getByText(SAVE_FAILED)).toBeVisible();
    await expect(tile).toBeChecked();
    expect(await photoSelected(seeded.workspaceId)).toEqual([true]);
    await page.unroute("**/w/**");

    await tile.uncheck();
    await expect.poll(() => photoSelected(seeded.workspaceId)).toEqual([false]);
    await expect(page.getByText(SAVE_FAILED)).toHaveCount(0);
  });

  test("after earlier saves and a refresh, a failed save resyncs to the latest saved values", async () => {
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "brand-name-header-text",
      brandPages: true,
    });
    await page.goto(`/w/${seeded.workspaceId}`);
    const tile = page.getByRole("checkbox", { name: /^Use photo 1/ });
    const audience = page.getByLabel("Target audience");

    await page.getByLabel("Occasion").fill("Spring");
    await page.getByLabel("Occasion").blur();
    await expect
      .poll(async () => (await workspaceRow(seeded.workspaceId))?.campaign)
      .toMatchObject({ occasion: "Spring" });
    // The campaign save refreshes the page with a newer server snapshot.
    await page.waitForTimeout(1500);

    await audience.fill("Later audience");
    await audience.blur();
    await expect
      .poll(async () => (await workspaceRow(seeded.workspaceId))?.brand_kit)
      .toMatchObject({ audience: "Later audience" });

    await page.route("**/w/**", (route) =>
      "next-action" in route.request().headers()
        ? route.abort()
        : route.continue(),
    );
    await tile.uncheck();
    await expect(page.getByText(SAVE_FAILED)).toBeVisible();
    await page.unroute("**/w/**");
    await expect(tile).toBeChecked();
    await expect(audience).toHaveValue("Later audience");
    await expect(page.getByLabel("Occasion")).toHaveValue("Spring");
  });
});
