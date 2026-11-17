import "server-only";
import { z } from "zod";
import {
  listCoverThumbs,
  listWorkspaces,
  softDeleteWorkspace,
} from "@/lib/db/queries";
import type { Result } from "./result";
import { logoSchema } from "./schemas";
import { signUrls } from "./urls";

const productSchema = z.object({
  shopify: z.object({ title: z.string() }),
  storeName: z.string().nullable(),
});

// Phase 6 answers this from the rounds table: the latest round number of each workspace, absent when none has started.
async function latestRounds(userId: string, workspaceIds: string[]) {
  void userId;
  void workspaceIds;
  return new Map<string, number>();
}

const updatedFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// The tester's live workspaces, newest first. Thumbnails (the cover photo, else the logo) are signed for a few minutes.
export async function loadHistory(userId: string) {
  const workspaces = await listWorkspaces(userId);
  const ids = workspaces.map((workspace) => workspace.id);
  const [covers, rounds] = await Promise.all([
    listCoverThumbs(userId, ids),
    latestRounds(userId, ids),
  ]);
  const logos = new Map(
    workspaces.flatMap((workspace) => {
      const path = logoSchema.safeParse(workspace.logo).data?.pngPath;
      return path ? [[workspace.id, path] as const] : [];
    }),
  );
  const [coverUrls, logoUrls] = await Promise.all([
    signUrls("photos", [...covers.values()]),
    signUrls("logos", [...logos.values()]),
  ]);

  return workspaces.map((workspace) => {
    const product = productSchema.safeParse(workspace.product);
    if (!product.success) {
      console.error(
        `workspace ${workspace.id}: stored product is unreadable`,
        product.error,
      );
    }
    const cover = covers.get(workspace.id);
    const logo = logos.get(workspace.id);
    return {
      id: workspace.id,
      title: product.data?.shopify.title ?? "Untitled product",
      store: product.data?.storeName ?? new URL(workspace.sourceUrl).hostname,
      thumbUrl:
        (cover && coverUrls.get(cover)) ?? (logo && logoUrls.get(logo)) ?? null,
      round: rounds.get(workspace.id) ?? 0,
      updatedAt: workspace.updatedAt,
      updatedLabel: updatedFormat.format(new Date(workspace.updatedAt)),
    };
  });
}

export type HistoryItem = Awaited<ReturnType<typeof loadHistory>>[number];

export async function deleteWorkspace(
  userId: string,
  workspaceId: string,
): Promise<Result> {
  return (await softDeleteWorkspace(userId, workspaceId))
    ? { ok: true }
    : { ok: false, code: "not_found" };
}
