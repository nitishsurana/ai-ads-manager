"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireTester } from "@/lib/auth";
import { deleteWorkspace, type Result } from "@/lib/workspace";

export type DeleteResult = Result | { ok: false; code: "invalid" };

export async function deleteWorkspaceAction(
  workspaceId: string,
): Promise<DeleteResult> {
  const parsed = z.uuid().safeParse(workspaceId);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const { userId } = await requireTester();
  const result = await deleteWorkspace(userId, parsed.data);
  refresh();
  return result;
}
