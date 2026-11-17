import { expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const TESTER_PASSWORD = process.env.TESTER_PASSWORD ?? "";
export const FAKE_PROVIDERS = (process.env.PROVIDERS ?? "fake") === "fake";

export const secret = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);

export const userIds = new Set<string>();

export async function deleteUsers() {
  // Deleting the user cascades to its threads, messages, facts, intakes, workspaces, photos and costs.
  for (const id of userIds) await secret.auth.admin.deleteUser(id);
}

export async function signedInContext(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Tester password").fill(TESTER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  const cookie = (await context.cookies()).find((c) => c.name === "tester");
  const body = (cookie?.value ?? "").split(".")[0] ?? "";
  const { uid } = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as { uid: string };
  userIds.add(uid);
  return { context, page, uid };
}

export async function sendMessage(page: Page, text: string) {
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

export function intakeIdOf(page: Page) {
  return /\/r\/([0-9a-f-]{36})$/.exec(page.url())?.[1] ?? "";
}
