"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireTester } from "@/lib/auth";
import { briefEditSchema, saveBriefRules } from "@/lib/brief/edit";
import { editCreative, rateCreative } from "@/lib/round";
import { TAGS } from "@/lib/round/feedback/tags";
import type { RoundFailure, RoundResult } from "@/lib/round/result";

const INVALID: RoundFailure = { ok: false, code: "save_failed" };

const target = z.object({
  workspaceId: z.uuid(),
  creativeId: z.uuid(),
  rev: z.number().int().nonnegative(),
});

const ratingSchema = target.extend({
  rating: z.enum(["approve", "reject"]).nullable(),
  tags: z
    .array(z.enum(TAGS))
    .max(TAGS.length)
    .transform((tags) => [...new Set(tags)]),
  note: z.string().max(500),
});

const editSchema = target.extend({
  headline: z.string().max(300),
  cta: z.string().max(300),
});

// Same order as the other actions: validate, ask who is calling, then write; the lib functions check ownership through the creative's round.
export async function rateCreativeAction(
  input: unknown,
): Promise<RoundResult<{ rev: number }>> {
  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { userId } = await requireTester();
  const { workspaceId, ...rating } = parsed.data;
  return rateCreative(userId, workspaceId, rating);
}

export async function editCreativeAction(
  input: unknown,
): Promise<RoundResult<{ rev: number }>> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { userId } = await requireTester();
  const { workspaceId, ...edit } = parsed.data;
  const result = await editCreative(userId, workspaceId, edit);
  if (result.ok) refresh();
  return result;
}

export async function saveBriefAction(
  workspaceId: string,
  edit: unknown,
): Promise<RoundResult<{ version: number }>> {
  const parsed = briefEditSchema
    .extend({ workspaceId: z.uuid() })
    .safeParse({ ...(edit as object), workspaceId });
  if (!parsed.success) return INVALID;
  const { userId } = await requireTester();
  const result = await saveBriefRules(userId, workspaceId, parsed.data);
  if (result.ok) refresh();
  return result;
}
