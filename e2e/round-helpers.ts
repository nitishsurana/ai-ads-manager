import { expect, type Page } from "@playwright/test";
import { generate, roundsOf } from "./confirm-helpers";
import { secret } from "./helpers";

export const SCREEN_TIMEOUT = 60_000;

export async function previewFiles(roundId: string) {
  const { data } = await secret.storage.from("previews").list(roundId);
  return data?.map((file) => file.name).sort() ?? [];
}

type Judge = {
  pass: boolean;
  lowConfidence: boolean;
  mean: number;
  judges: unknown[];
};

export async function judgedCreatives(roundId: string) {
  const { data } = await secret
    .from("creatives")
    .select("n, angle, supporting_element, judge")
    .eq("round_id", roundId)
    .order("n");
  return (data ?? []).map((row) => ({
    ...row,
    judge: row.judge as Judge | null,
  }));
}

// Paid calls the round recorded, by task.
export async function callsOf(roundId: string, task: string) {
  const { data } = await secret
    .from("costs")
    .select("meta")
    .eq("round_id", roundId);
  return (data ?? []).filter(
    (cost) => (cost.meta as { task?: string }).task === task,
  ).length;
}

// Runs one round of a scenario on a fresh workspace and waits for it to end.
export async function runScenario(
  page: Page,
  scenario: string,
  seed: () => Promise<{ workspaceId: string }>,
) {
  const { workspaceId } = await seed();
  await secret
    .from("workspaces")
    .update({ campaign: { occasion: `fake:${scenario}` } })
    .eq("id", workspaceId);
  await page.goto(`/w/${workspaceId}`);
  await generate(page).click();
  await expect
    .poll(async () => (await roundOf(workspaceId))?.status, {
      timeout: SCREEN_TIMEOUT,
    })
    .toBe("done");
  const round = await roundOf(workspaceId);
  const roundId = round?.id ?? "";
  // Costs are written after the round ends.
  await expect.poll(() => callsOf(roundId, "judge")).toBeGreaterThan(0);
  return { workspaceId, roundId };
}

export const roundOf = async (workspaceId: string, index = 0) =>
  (await roundsOf(workspaceId))[index];

const BRIEF_CONTENT = {
  rules: [],
  campaign: {},
  research: [],
  values: {
    price: null,
    wasPrice: null,
    currency: "USD",
    rating: null,
    brandName: null,
  },
  exemplarCreativeIds: [],
  approvedAngles: [],
  settings: {
    productSize: "normal",
    preferCutout: false,
    backgroundStyle: "any",
  },
};

// A round that is already over, inserted for cases the UI can't reach.
export async function insertRounds(
  userId: string,
  workspaceId: string,
  rounds: Record<string, unknown>[],
) {
  await secret.from("briefs").insert({
    workspace_id: workspaceId,
    user_id: userId,
    version: 1,
    cause: "initial",
    content: BRIEF_CONTENT,
  });
  await secret
    .from("workspaces")
    .update({ phase: "rounds" })
    .eq("id", workspaceId);
  const { error } = await secret.from("rounds").insert(
    rounds.map((round) => ({
      workspace_id: workspaceId,
      user_id: userId,
      brief_version: 1,
      inputs: {},
      ...round,
    })),
  );
  expect(error).toBeNull();
}

export const tryAgain = (page: Page) =>
  page.getByRole("button", { name: /^(Try again|Retry)/ });
