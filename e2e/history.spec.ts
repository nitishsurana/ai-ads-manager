// Runs against `next dev` with PROVIDERS=fake. Workspaces are seeded from committed fixtures (see seed.ts); pasting the product again goes through the chat.
import { expect, test, type Page, type Request } from "@playwright/test";
import { productKeyOf } from "../lib/intake/product-key";
import { nextAction } from "./confirm-helpers";
import {
  FAKE_PROVIDERS,
  resetTesters,
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

async function workspace(id: string) {
  const { data } = await secret
    .from("workspaces")
    .select("deleted_at, product")
    .eq("id", id)
    .single();
  return data as { deleted_at: string | null; product: unknown } | null;
}

type StoredProduct = { shopify: { title: string } };

async function titleOf(id: string) {
  return ((await workspace(id))?.product as StoredProduct).shopify.title;
}

// Every fixture sells a Blue Mug, so a second workspace is renamed to tell the rows apart.
async function rename(id: string, title: string) {
  const product = (await workspace(id))?.product as StoredProduct;
  await secret
    .from("workspaces")
    .update({ product: { ...product, shopify: { ...product.shopify, title } } })
    .eq("id", id);
}

const rows = (page: Page) =>
  page.getByRole("list", { name: "Workspaces" }).getByRole("listitem");

test.describe("history", () => {
  let a: Awaited<ReturnType<typeof testerContext>>;
  let mug: { id: string; title: string };
  let other: { id: string; title: string };
  let deleteRequest: Request;

  test.beforeAll(async ({ browser }) => {
    a = await testerContext(browser, "a");
    const seededMug = await seedWorkspace({
      userId: a.uid,
      fixture: "brand-name-header-text",
      brandPages: true,
      productKey: productKeyOf(new URL(SUCCESS_URL)) ?? undefined,
    });
    const seededOther = await seedWorkspace({
      userId: a.uid,
      fixture: "quick-checkout-disabled",
    });
    await rename(seededOther.workspaceId, "Green Mug");
    mug = {
      id: seededMug.workspaceId,
      title: await titleOf(seededMug.workspaceId),
    };
    other = { id: seededOther.workspaceId, title: "Green Mug" };
  });
  test.afterAll(async () => {
    await a?.context.close();
  });

  test("lists the tester's workspaces newest first, each opening its workspace", async () => {
    const { page } = a;
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(0)).toContainText(other.title);
    await expect(rows(page).nth(1)).toContainText(mug.title);

    const row = rows(page).nth(1);
    await expect(row).toContainText("Header Brand");
    await expect(row).toContainText("Not generated yet");
    const thumb = row.locator("img");
    await expect
      .poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect(
      row.getByRole("link", { name: `Open ${mug.title}` }),
    ).toHaveAttribute("href", `/w/${mug.id}`);
  });

  test("delete asks first, and Cancel keeps the workspace", async () => {
    const { page } = a;
    await page.getByRole("button", { name: `Delete ${mug.title}` }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "Delete this workspace?",
    });
    await expect(dialog).toContainText(
      `${mug.title} and its confirmed details will be removed from this browser. PNGs you’ve downloaded aren’t affected. This can’t be undone.`,
    );
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(rows(page)).toHaveCount(2);
    expect((await workspace(mug.id))?.deleted_at).toBeNull();
  });

  test("Delete soft-deletes: the row goes, the data stays, and the workspace 404s", async () => {
    const { page } = a;
    await page.getByRole("button", { name: `Delete ${mug.title}` }).click();
    const request = nextAction(page);
    await page.getByRole("button", { name: "Delete workspace" }).click();
    deleteRequest = await request;

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(other.title);
    expect((await workspace(mug.id))?.deleted_at).not.toBeNull();
    expect((await page.goto(`/w/${mug.id}`))?.status()).toBe(404);
  });

  test("another tester sees none of these workspaces and a replayed delete is rejected", async ({
    browser,
  }) => {
    const b = await testerContext(browser, "b");
    await b.page.goto("/history");
    await expect(
      b.page.getByText("No workspaces yet. Paste a product link to start one."),
    ).toBeVisible();
    await expect(b.page.getByText(other.title)).toHaveCount(0);

    const replay = await b.context.request.post("/history", {
      headers: {
        "next-action": deleteRequest.headers()["next-action"] ?? "",
        "content-type": "text/plain;charset=UTF-8",
      },
      data: (deleteRequest.postData() ?? "").replace(mug.id, other.id),
    });
    expect(await replay.text()).toContain("not_found");
    expect((await workspace(other.id))?.deleted_at).toBeNull();
    await b.context.close();
  });

  test("pasting the deleted product again starts a new workspace", async () => {
    const { page } = a;
    await page.goto("/");
    await sendMessage(page, `Make ads for ${SUCCESS_URL}`);
    await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/, {
      timeout: SCREEN_TIMEOUT,
    });
    const id = /\/w\/([0-9a-f-]{36})$/.exec(page.url())?.[1] ?? "";
    expect(id).not.toBe(mug.id);
    expect((await workspace(id))?.deleted_at).toBeNull();

    await page.goto("/history");
    await expect(rows(page)).toHaveCount(2);
    await expect(
      page.getByRole("link", { name: `Open ${mug.title}` }),
    ).toHaveAttribute("href", `/w/${id}`);
  });

  test("a workspace's top bar starts a new workspace; History's has no second button", async () => {
    const { page } = a;
    const header = page.getByRole("banner");
    await page.goto("/history");
    await expect(
      header.getByRole("link", { name: "New workspace" }),
    ).toHaveCount(0);

    await page.goto(`/w/${other.id}`);
    await header.getByRole("link", { name: "New workspace" }).click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Start with a product link" }),
    ).toBeVisible();
    await expect(
      header.getByRole("link", { name: "New workspace" }),
    ).toHaveCount(0);
  });
});
