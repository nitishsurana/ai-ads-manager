import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { resetTesters, testerContext } from "./helpers";

const TESTER_PASSWORD = process.env.TESTER_PASSWORD ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const BROWSER_ONLY_NOTE =
  "Work is saved in this browser only. Clearing browser data starts fresh.";

const secretClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);

const createdUserIds = new Set<string>();

async function cookieValue(context: BrowserContext, name: string) {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === name)?.value;
}

async function testerPayload(context: BrowserContext) {
  const value = await cookieValue(context, "tester");
  if (!value) throw new Error("No tester cookie");
  const body = value.split(".")[0] ?? "";
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
    uid: string;
    name: string;
  };
}

async function signInTester(
  page: Page,
  name: string,
  password = TESTER_PASSWORD,
) {
  await page.goto("/sign-in");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Tester password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function newTesterContext(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInTester(page, name);
  await expect(page).toHaveURL("/");
  createdUserIds.add((await testerPayload(context)).uid);
  return { context, page };
}

test.afterAll(async () => {
  await resetTesters();
  for (const id of createdUserIds) {
    await secretClient.auth.admin.deleteUser(id);
  }
});

test.describe.configure({ mode: "serial" });

test.describe("tester access", () => {
  let a: Awaited<ReturnType<typeof newTesterContext>>;

  test("signed out visit redirects to sign-in with the browser-only note", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in\?next=%2F$/);
    await expect(page.getByText(BROWSER_ONLY_NOTE)).toBeVisible();
  });

  test("wrong password and blank name show their messages", async ({
    page,
  }) => {
    await signInTester(page, "Priya", "not-the-password");
    await expect(page.locator("form").getByRole("alert")).toHaveText(
      "That password isn't right.",
    );
    await expect(page).toHaveURL(/\/sign-in/);

    await signInTester(page, "   ");
    await expect(page.locator("form").getByRole("alert")).toHaveText(
      "Enter your name, up to 40 characters.",
    );
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("correct sign-in shows the name and creates a testers row", async ({
    browser,
  }) => {
    a = await newTesterContext(browser, "Priya");
    await expect(a.page.getByText("Priya", { exact: true })).toBeVisible();

    const { uid } = await testerPayload(a.context);
    const { data } = await secretClient
      .from("testers")
      .select("user_id, name, is_golden")
      .eq("user_id", uid)
      .single();
    expect(data).toEqual({ user_id: uid, name: "Priya", is_golden: false });
  });

  test("signing in again keeps the user id and updates the name", async () => {
    const before = await testerPayload(a.context);
    await a.page.context().clearCookies({ name: "tester" });
    await signInTester(a.page, "Priya R");
    await expect(a.page).toHaveURL("/");

    const after = await testerPayload(a.context);
    expect(after.uid).toBe(before.uid);
    await expect(a.page.getByText("Priya R", { exact: true })).toBeVisible();
    const { data } = await secretClient
      .from("testers")
      .select("name")
      .eq("user_id", before.uid)
      .single();
    expect(data).toEqual({ name: "Priya R" });
  });

  test("sign-in never redirects off-site through next", async () => {
    const offSite = [
      "//evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "/.//evil.com",
      "/\\evil.com",
    ];
    for (const next of offSite) {
      await a.page.context().clearCookies({ name: "tester" });
      await a.page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
      const nextField = a.page.locator('input[name="next"]');
      await expect(nextField).toHaveValue("/");
      // The action re-checks next, so tamper with the field to test that check too.
      await nextField.evaluate((el, value) => {
        (el as HTMLInputElement).value = value;
      }, next);
      await a.page.getByLabel("Your name").fill("Priya R");
      await a.page.getByLabel("Tester password").fill(TESTER_PASSWORD);
      await a.page.getByRole("button", { name: "Sign in" }).click();
      await expect(a.page).toHaveURL("/");
    }
  });

  test("the sign-in page redirects home when already signed in", async () => {
    await a.page.goto("/sign-in");
    await expect(a.page).toHaveURL("/");
  });

  test("a second browser is isolated from the first", async ({ browser }) => {
    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await freshPage.goto("/");
    await expect(freshPage).toHaveURL(/\/sign-in/);
    await fresh.close();

    // The shared tester B, signed in by the global setup, is a second user.
    const { context: second, page: secondPage } = await testerContext(
      browser,
      "b",
    );
    await expect(secondPage).toHaveURL("/");
    const secondPayload = await testerPayload(second);
    expect(secondPayload.uid).not.toBe((await testerPayload(a.context)).uid);

    const stolenCookie = await cookieValue(a.context, "tester");
    const stolenTesterCookie = {
      name: "tester",
      value: stolenCookie ?? "",
      url: "http://localhost:3000",
    };

    const bare = await browser.newContext();
    await bare.addCookies([stolenTesterCookie]);
    const barePage = await bare.newPage();
    await barePage.goto("/");
    await expect(barePage).toHaveURL(/\/sign-in/);
    expect((await bare.request.get("/api/anything")).status()).toBe(401);

    const secondSession = (await second.cookies()).filter((c) =>
      c.name.startsWith("sb-"),
    );
    const mismatched = await browser.newContext();
    await mismatched.addCookies([...secondSession, stolenTesterCookie]);
    const mismatchedPage = await mismatched.newPage();
    await mismatchedPage.goto("/");
    await expect(mismatchedPage).toHaveURL(/\/sign-in/);

    await Promise.all([second.close(), bare.close(), mismatched.close()]);
  });

  test.afterAll(async () => {
    await a?.context.close();
  });
});

test.describe("admin access", () => {
  test("signed out visit redirects to admin sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin/sign-in");
  });

  test("wrong password shows the error, correct password opens the console", async ({
    page,
  }) => {
    await page.goto("/admin/sign-in");
    await page.getByLabel("Admin password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(
      "That password isn't right.",
    );

    await page.getByLabel("Admin password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/admin");
    await expect(page.getByText("Admin access")).toBeVisible();

    await page.goto("/admin/sign-in");
    await expect(page).toHaveURL("/admin");
  });

  test("the tester and admin cookies never grant each other's routes", async ({
    browser,
  }) => {
    const tester = await testerContext(browser, "b");
    await tester.page.goto("/admin");
    await expect(tester.page).toHaveURL("/admin/sign-in");
    await tester.context.close();

    const admin = await browser.newContext();
    const adminPage = await admin.newPage();
    await adminPage.goto("/admin/sign-in");
    await adminPage.getByLabel("Admin password").fill(ADMIN_PASSWORD);
    await adminPage.getByRole("button", { name: "Sign in" }).click();
    await expect(adminPage).toHaveURL("/admin");
    await adminPage.goto("/");
    await expect(adminPage).toHaveURL(/\/sign-in/);
    await admin.close();
  });
});
