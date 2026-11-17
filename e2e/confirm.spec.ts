// Runs against `next dev` with PROVIDERS=fake. One workspace is read through the chat and then edited step by step; confirm-states.spec.ts covers the other states from seeded workspaces.
import { expect, test } from "@playwright/test";
import {
  generate,
  nextAction,
  photoSelected,
  roundsOf,
  workspaceRow,
} from "./confirm-helpers";
import {
  removeRoundFiles,
  resetTesters,
  FAKE_PROVIDERS,
  secret,
  sendMessage,
  testerContext,
} from "./helpers";
import { seedWorkspace } from "./seed";

const SUCCESS_URL = "https://shopabc.myshopify.com/products/blue-mug";
const SCREEN_TIMEOUT = 60_000;

test.skip(!FAKE_PROVIDERS, "replays committed fixtures");
test.afterAll(resetTesters);
test.describe.configure({ mode: "serial" });

test.describe("confirm", () => {
  let a: Awaited<ReturnType<typeof testerContext>>;
  let workspaceId: string;

  test.beforeAll(async ({ browser }) => {
    a = await testerContext(browser, "a");
  });
  test.afterAll(async () => {
    await a?.context.close();
  });

  test("a full success lands on Confirm with photos, brand kit, price and rating", async () => {
    const { page } = a;
    await sendMessage(
      page,
      `Diwali gifting for young professionals. 20% off for Diwali. ${SUCCESS_URL}`,
    );
    await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/, {
      timeout: SCREEN_TIMEOUT,
    });
    workspaceId = /\/w\/([0-9a-f-]{36})$/.exec(page.url())?.[1] ?? "";

    await expect(
      page.getByRole("heading", { name: "Confirm what we found" }),
    ).toBeVisible();
    await expect(page.getByText("1 of 1 selected")).toBeVisible();
    const photo = page.getByRole("img", { name: "Product photo 1" });
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    const brand = page.locator("#brand");
    await expect(brand.getByText("Header Brand")).toHaveCount(2);
    await expect(brand.getByLabel("Primary hex value")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Price", exact: true }),
    ).toHaveValue("18.00");
    await expect(page.getByText("$18.00", { exact: true })).toBeVisible();
    await expect(page.getByText("No rating found.")).toBeVisible();

    await expect(page.getByLabel("Occasion")).toHaveValue("Diwali");
    await expect(page.getByLabel("Audience", { exact: true })).toHaveValue(
      "Young professionals",
    );
    await expect(
      page.locator("#facts").getByText("Needs your OK"),
    ).toBeVisible();
    await expect(page.getByText("1 photo · price on")).toBeVisible();
    await expect(
      page.getByText("1 fact isn’t confirmed, so it won’t appear in ads."),
    ).toBeVisible();
    await expect(generate(page)).toBeEnabled();
    await expect(
      page.getByRole("log", { name: "Conversation" }).getByRole("link", {
        name: "Confirm in step 1",
      }),
    ).toBeVisible();
  });

  test("deselecting every photo blocks Generate, and the choice is kept", async () => {
    const { page } = a;
    const tile = page.getByRole("checkbox", { name: /^Use photo 1/ });
    await tile.uncheck();
    await expect(generate(page)).toBeDisabled();
    await expect(
      page.getByText("Select at least one photo to continue."),
    ).toBeVisible();
    await expect.poll(() => photoSelected(workspaceId)).toEqual([false]);

    await page.reload();
    await expect(tile).not.toBeChecked();
    await expect(generate(page)).toBeDisabled();
    await page.getByRole("button", { name: "Select all" }).click();
    await expect(tile).toBeChecked();
    await expect(generate(page)).toBeEnabled();
    await expect.poll(() => photoSelected(workspaceId)).toEqual([true]);
  });

  test("a fact from chat shows pending and can be confirmed, edited and removed", async () => {
    const { page } = a;
    const facts = page.locator("#facts");
    const row = (text: string) =>
      facts.locator("div.rounded-\\[10px\\]").filter({ hasText: text });

    await row("20% off for Diwali")
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(
      row("20% off for Diwali").getByText("Confirmed"),
    ).toBeVisible();
    await expect(page.getByText("1 fact confirmed")).toBeVisible();
    await expect
      .poll(async () => {
        const { data } = await secret
          .from("facts")
          .select("status")
          .eq("text", "20% off for Diwali");
        return data;
      })
      .toEqual([{ status: "confirmed" }]);

    await row("20% off for Diwali")
      .getByRole("button", { name: "Edit" })
      .click();
    await page.getByLabel("Edit fact").fill("25% off for Diwali");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      row("25% off for Diwali").getByText("Needs your OK"),
    ).toBeVisible();

    await sendMessage(page, "Free gift wrap on all orders.");
    await expect(row("Free gift wrap on all orders")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      row("Free gift wrap on all orders").getByText("Needs your OK"),
    ).toBeVisible();
    await expect(
      page.getByText("2 facts aren’t confirmed, so they won’t appear in ads."),
    ).toBeVisible();

    await row("25% off for Diwali")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(row("25% off for Diwali")).toHaveCount(0);
    await expect
      .poll(async () => {
        const { data } = await secret
          .from("facts")
          .select("text")
          .eq("text", "25% off for Diwali");
        return data;
      })
      .toEqual([]);

    await row("Free gift wrap on all orders")
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(
      row("Free gift wrap on all orders").getByText("Confirmed"),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const { data } = await secret
          .from("facts")
          .select("status")
          .eq("text", "Free gift wrap on all orders");
        return data;
      })
      .toEqual([{ status: "confirmed" }]);

    await page.reload();
    await expect(
      row("Free gift wrap on all orders").getByText("Confirmed"),
    ).toBeVisible();
    await expect(row("25% off for Diwali")).toHaveCount(0);
  });

  test("the price card hides, edits and switches currency only with a new price", async () => {
    const { page } = a;
    const price = page.getByRole("textbox", { name: "Price", exact: true });

    await page.getByRole("switch", { name: "Show price" }).click();
    await expect(page.getByText("Price won’t appear in ads.")).toBeVisible();
    await page.getByRole("switch", { name: "Show price" }).click();

    await page.getByRole("button", { name: "Add was price" }).click();
    await page.getByRole("textbox", { name: "Was price" }).fill("25");
    await price.focus();
    await expect(page.getByText("$25.00")).toBeVisible();
    await page.getByRole("button", { name: "Remove was price" }).click();
    await expect(page.getByRole("textbox", { name: "Was price" })).toHaveCount(
      0,
    );

    await page.getByRole("combobox", { name: "Currency" }).click();
    await page.getByRole("option", { name: "EUR" }).click();
    await expect(
      page.getByText("Enter the price in EUR to continue."),
    ).toBeVisible();
    await expect(generate(page)).toBeDisabled();
    await price.fill("0");
    await price.blur();
    await expect(page.getByText("Enter an amount above zero.")).toBeVisible();
    await price.fill("15.50");
    await price.blur();
    await expect(page.getByText("€15.50", { exact: true })).toBeVisible();
    await expect(generate(page)).toBeEnabled();
    await expect
      .poll(async () => (await workspaceRow(workspaceId))?.confirmed)
      .toMatchObject({ currency: "EUR", price: "€15.50", pricingEdited: true });

    await page.reload();
    await expect(price).toHaveValue("15.50");
    await expect(page.getByRole("combobox", { name: "Currency" })).toHaveText(
      "EUR",
    );
    await expect(page.getByText("€15.50", { exact: true })).toBeVisible();
    await expect(generate(page)).toBeEnabled();
  });

  test("brand kit edits are kept", async () => {
    const { page } = a;
    await page.getByLabel("Target audience").fill("Gift buyers in cities");
    await page.getByLabel("Tone word 1").focus();
    await page.getByRole("button", { name: "Add proof point" }).click();
    await page
      .getByRole("textbox", { name: "Proof point 2" })
      .fill("Rated 4.8 by 300 customers");
    await page.getByLabel("Primary hex value").fill("#112233");
    await page.getByLabel("Tone word 1").focus();
    await expect
      .poll(async () => (await workspaceRow(workspaceId))?.brand_kit)
      .toMatchObject({
        audience: "Gift buyers in cities",
        proofPoints: ["Family owned since 2009", "Rated 4.8 by 300 customers"],
        palette: { primary: "#112233" },
      });

    await page.reload();
    await expect(page.getByLabel("Target audience")).toHaveValue(
      "Gift buyers in cities",
    );
    await expect(
      page.getByRole("textbox", { name: "Proof point 2" }),
    ).toHaveValue("Rated 4.8 by 300 customers");
  });

  test("two campaign fields edited back to back both persist", async () => {
    const { page } = a;
    await page.getByLabel("Occasion").fill("Eid");
    await page.getByLabel("Angle").fill("Gifting");
    await page.getByLabel("Occasion").focus();
    await expect
      .poll(async () => (await workspaceRow(workspaceId))?.campaign)
      .toMatchObject({ occasion: "Eid", angle: "Gifting" });

    await page.reload();
    await expect(page.getByLabel("Occasion")).toHaveValue("Eid");
    await expect(page.getByLabel("Angle")).toHaveValue("Gifting");
    await expect(page.getByLabel("Audience", { exact: true })).toHaveValue(
      "Young professionals",
    );
  });

  test("Generate saves the confirmed values and starts the first round", async () => {
    const { page } = a;
    await generate(page).click();
    await expect(page.getByRole("heading", { name: "Round 1" })).toBeVisible();
    await expect
      .poll(async () => (await workspaceRow(workspaceId))?.confirmed)
      .toMatchObject({ currency: "EUR", brandName: { needed: false } });
    expect((await workspaceRow(workspaceId))?.phase).toBe("rounds");

    // The later tests use this workspace as an unstarted one: let the round end, then undo it.
    await expect
      .poll(async () => (await roundsOf(workspaceId))[0]?.status, {
        timeout: SCREEN_TIMEOUT,
      })
      .toBe("done");
    await removeRoundFiles((await roundsOf(workspaceId)).map((r) => r.id));
    await secret.from("rounds").delete().eq("workspace_id", workspaceId);
    await secret.from("briefs").delete().eq("workspace_id", workspaceId);
    await secret
      .from("workspaces")
      .update({ phase: "confirm" })
      .eq("id", workspaceId);
  });

  test("another tester gets 404 on the workspace and their server actions are rejected", async ({
    browser,
  }) => {
    const { page } = a;
    await page.goto(`/w/${workspaceId}`);
    const request = nextAction(page);
    await page.getByRole("checkbox", { name: /^Use photo 1/ }).uncheck();
    const saved = await request;
    await expect.poll(() => photoSelected(workspaceId)).toEqual([false]);
    await page.getByRole("button", { name: "Select all" }).click();
    await expect.poll(() => photoSelected(workspaceId)).toEqual([true]);

    const b = await testerContext(browser, "b");
    expect((await b.page.goto(`/w/${workspaceId}`))?.status()).toBe(404);
    expect((await b.page.goto(`/w/${workspaceId}/confirm`))?.status()).toBe(
      404,
    );

    const replay = await b.context.request.post(`/w/${workspaceId}`, {
      headers: {
        "next-action": saved.headers()["next-action"] ?? "",
        "content-type": "text/plain;charset=UTF-8",
      },
      data: saved.postData() ?? "",
    });
    expect(await replay.text()).toContain("not_found");
    expect(await photoSelected(workspaceId)).toEqual([true]);
    await b.context.close();
  });

  test("a personalized product shows the personalize note and no can't-buy flag", async () => {
    const { page, uid } = a;
    const seeded = await seedWorkspace({
      userId: uid,
      fixture: "personalize-outside-form",
    });
    await page.goto(`/w/${seeded.workspaceId}`);
    await expect(
      page.getByText(
        "Shoppers personalize this product before ordering, so every button will invite them to personalize it.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Shoppers can't buy this online right now. Continue anyway?",
      ),
    ).toHaveCount(0);
    await expect(generate(page)).toBeEnabled();
  });
});
