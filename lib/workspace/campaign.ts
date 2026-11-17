import "server-only";
import { z } from "zod";
import { parseCampaign } from "@/lib/chat/campaign";
import { getWorkspace, updateWorkspaceIf } from "@/lib/db/queries";
import { retryOnMiss } from "./cas";
import type { Failure, Result } from "./result";
import { isLocked } from "./rounds";

const field = z.string().trim().max(80);

// The fields the tester changed, as the screen shows them; a blank clears that field.
export const campaignEditSchema = z
  .strictObject({
    occasion: field.optional(),
    angle: field.optional(),
    audience: field.optional(),
  })
  .refine((edit) => Object.keys(edit).length > 0);

// Merged into the campaign as it is now, and written only if nothing wrote since it was read, so a change made in chat meanwhile is kept.
export async function saveCampaign(
  userId: string,
  workspaceId: string,
  edit: z.infer<typeof campaignEditSchema>,
): Promise<Result> {
  const result = await retryOnMiss<Result>(async () => {
    const workspace = await getWorkspace(userId, workspaceId);
    if (!workspace) return { ok: false, code: "not_found" };
    if (await isLocked(userId, workspace)) {
      return { ok: false, code: "confirm_locked" };
    }
    const merged = { ...parseCampaign(workspace.campaign), ...edit };
    const campaign = parseCampaign(
      Object.fromEntries(Object.entries(merged).filter(([, text]) => text)),
    );
    const written = await updateWorkspaceIf(
      userId,
      workspaceId,
      workspace.updatedAt,
      { campaign },
    );
    return written ? { ok: true } : null;
  });
  if (!result) {
    console.error(`workspace ${workspaceId}: campaign save lost the race`);
    return { ok: false, code: "save_failed" } satisfies Failure;
  }
  return result;
}
