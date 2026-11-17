import "server-only";
import { getLatestRound } from "@/lib/db/queries";
import { housekeep } from "./housekeeping";
import type { RoundStatusView } from "./schema";
import { toStatusView } from "./status";
import { loadRoundView, type RoundView } from "./view";

export type RoundScreenData =
  | { kind: "none" }
  | { kind: "generating"; status: RoundStatusView }
  | { kind: "round"; view: RoundView };

// The latest round as the main pane shows it; housekeeping runs first.
export async function loadRoundScreen(
  userId: string,
  workspaceId: string,
): Promise<RoundScreenData> {
  await housekeep(userId);
  const round = await getLatestRound(userId, workspaceId);
  if (!round) return { kind: "none" };
  return round.status === "done"
    ? { kind: "round", view: await loadRoundView(userId, round) }
    : { kind: "generating", status: toStatusView(round) };
}
