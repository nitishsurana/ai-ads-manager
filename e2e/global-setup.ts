import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect, type FullConfig } from "@playwright/test";
import {
  AUTH_DIR,
  authFile,
  removeUserFiles,
  secret,
  TESTER_NAMES,
  TESTER_PASSWORD,
  testerIds,
  type TesterKey,
} from "./helpers";

async function deleteTesters(ids: string[]) {
  for (const id of ids) {
    await removeUserFiles(id);
    await secret.auth.admin.deleteUser(id);
  }
}

// Supabase allows about 30 anonymous sign-ins an hour, so the shared testers sign in once per run and every spec reuses their saved browser state. Only access.spec.ts signs in for itself, because that is what it tests.
export default async function globalSetup(config: FullConfig) {
  mkdirSync(AUTH_DIR, { recursive: true });
  const usersFile = join(AUTH_DIR, "users.json");
  // A run that crashed before its teardown left testers behind.
  if (existsSync(usersFile)) {
    await deleteTesters(Object.values(testerIds()));
  }

  const browser = await chromium.launch();
  const ids: Partial<Record<TesterKey, string>> = {};
  for (const key of Object.keys(TESTER_NAMES) as TesterKey[]) {
    const context = await browser.newContext({
      baseURL: config.projects[0]?.use.baseURL,
    });
    const page = await context.newPage();
    await page.goto("/sign-in");
    await page.getByLabel("Your name").fill(TESTER_NAMES[key]);
    await page.getByLabel("Tester password").fill(TESTER_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
    const cookie = (await context.cookies()).find((c) => c.name === "tester");
    const body = (cookie?.value ?? "").split(".")[0] ?? "";
    ids[key] = (
      JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
        uid: string;
      }
    ).uid;
    await context.storageState({ path: authFile(key) });
    await context.close();
  }
  await browser.close();
  writeFileSync(usersFile, JSON.stringify(ids));

  return async () => {
    await deleteTesters(Object.values(ids));
  };
}
