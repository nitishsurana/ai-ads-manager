import type { Page } from "@playwright/test";
import { secret } from "./helpers";

export const generate = (page: Page) =>
  page.getByRole("button", { name: "Generate creatives" });

export async function workspaceRow(id: string) {
  const { data } = await secret
    .from("workspaces")
    .select("confirmed, brand_kit, campaign, phase, product")
    .eq("id", id)
    .single();
  return data;
}

export async function photoSelected(id: string) {
  const { data } = await secret
    .from("photos")
    .select("selected")
    .eq("workspace_id", id);
  return data?.map((photo) => photo.selected);
}

// The next server action the page sends: its id and body can be replayed from another session.
export function nextAction(page: Page) {
  return page.waitForRequest(
    (r) => r.method() === "POST" && "next-action" in r.headers(),
  );
}

export async function roundsOf(workspaceId: string) {
  const { data } = await secret
    .from("rounds")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("n")
    .order("attempt");
  return data ?? [];
}
