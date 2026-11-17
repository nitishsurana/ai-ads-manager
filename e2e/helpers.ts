import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const TESTER_PASSWORD = process.env.TESTER_PASSWORD ?? "";
export const FAKE_PROVIDERS = (process.env.PROVIDERS ?? "fake") === "fake";

export const secret = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);

const INTAKE_BUCKETS = ["photos", "cutouts", "logos"];
const ROUND_BUCKETS = ["backgrounds", "previews"];

async function removePrefixes(buckets: string[], ids: string[]) {
  for (const id of ids) {
    for (const bucket of buckets) {
      const { data } = await secret.storage
        .from(bucket)
        .list(id, { limit: 1000 });
      if (data?.length) {
        await secret.storage
          .from(bucket)
          .remove(data.map((file) => `${id}/${file.name}`));
      }
    }
  }
}

export const removeRoundFiles = (roundIds: string[]) =>
  removePrefixes(ROUND_BUCKETS, roundIds);

// Deleting a user cascades its rows but not its Storage objects, which are keyed by intake and round id; they are listed from the rows before those go.
export async function removeUserFiles(userId: string) {
  const { data: intakes } = await secret
    .from("intakes")
    .select("id")
    .eq("user_id", userId);
  await removePrefixes(
    INTAKE_BUCKETS,
    (intakes ?? []).map((row) => row.id),
  );
  const { data: rounds } = await secret
    .from("rounds")
    .select("id")
    .eq("user_id", userId);
  await removeRoundFiles((rounds ?? []).map((row) => row.id));
}

// The shared testers are signed in once per run by global-setup.ts, which saves their browser state here.
export const AUTH_DIR = join("e2e", ".auth");
export const TESTER_NAMES = { a: "E2E A", b: "E2E B" } as const;
export type TesterKey = keyof typeof TESTER_NAMES;

export const authFile = (key: TesterKey) => join(AUTH_DIR, `${key}.json`);

export function testerIds() {
  return JSON.parse(
    readFileSync(join(AUTH_DIR, "users.json"), "utf8"),
  ) as Record<TesterKey, string>;
}

export async function testerContext(browser: Browser, key: TesterKey) {
  const context = await browser.newContext({ storageState: authFile(key) });
  const page = await context.newPage();
  await page.goto("/");
  return { context, page, uid: testerIds()[key] };
}

// Specs share testers one after another (one worker), so each leaves them as it found them: no threads, and so no workspaces, intakes, facts, messages or Storage files. Deleting the testers at the end of the run removes the rest.
export async function resetTesters() {
  for (const userId of Object.values(testerIds())) {
    await removeUserFiles(userId);
    await secret.from("threads").delete().eq("user_id", userId);
  }
}

export async function sendMessage(page: Page, text: string) {
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

export function intakeIdOf(page: Page) {
  return /\/r\/([0-9a-f-]{36})$/.exec(page.url())?.[1] ?? "";
}
