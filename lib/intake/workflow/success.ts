import "server-only";
import {
  completeIntake,
  completeIntakeWithWorkspace,
  getIntake,
} from "@/lib/db/queries";
import { mergeIntoExisting } from "@/lib/workspace/existing";
import type { IntakeResult } from "../types";
import { removeIntakeFiles } from "./cleanup";
import { photoRow, workspaceRow } from "./rows";
import type { IntakeRun } from "./types";

function summary(result: IntakeResult) {
  const { product, page, photos, brand } = result;
  const shown = photos.photos.filter((photo) => photo.selected).length;
  const details = [
    `${shown} usable ${shown === 1 ? "photo" : "photos"}`,
    page.price ? `price ${page.price}` : null,
    brand.logo ? "logo found" : "no logo found",
  ];
  return `I read ${product.title}: ${details.filter(Boolean).join(", ")}.`;
}

export type Persisted = { workspaceId: string | null };

// One database transaction decides the outcome, so a repeat or a lost race leaves nothing half-built. Files are removed when the intake had already failed, or only points at someone else's workspace; removal is idempotent.
export async function persistSuccess(
  run: IntakeRun,
  result: IntakeResult,
): Promise<Persisted> {
  const { workspaceId, adopted } = await completeIntakeWithWorkspace(
    run.userId,
    run.intakeId,
    {
      workspace: workspaceRow(result),
      photos: result.photos.photos.map(photoRow),
      summary: {
        ui_id: `intake-${run.intakeId}-summary`,
        parts: [{ type: "text", text: summary(result) }],
      },
    },
  );
  if (!adopted) await removeIntakeFiles(run.intakeId);
  return { workspaceId };
}

export async function persistExisting(
  run: IntakeRun,
  existingWorkspaceId: string,
): Promise<Persisted> {
  const completed = await completeIntake(run.userId, run.intakeId, {
    workspaceId: existingWorkspaceId,
    productKey: null,
  });
  // A retry after the update committed finds the intake already done.
  const intake = completed ? null : await getIntake(run.userId, run.intakeId);
  const workspaceId = completed
    ? existingWorkspaceId
    : intake?.status === "done"
      ? intake.workspaceId
      : null;
  // The chat turn repeats this when it ends; each merge replaces the last one's suggestion.
  if (workspaceId) await mergeIntoExisting(run, existingWorkspaceId);
  return { workspaceId };
}
