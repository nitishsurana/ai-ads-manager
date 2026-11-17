"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireTester } from "@/lib/auth";
import { answersSchema } from "@/lib/confirm/answers";
import {
  campaignEditSchema,
  type Result,
  deleteFact,
  generateCreatives,
  rewriteFact,
  saveAnswers,
  saveCampaign,
  saveChanges,
  setFactConfirmed,
} from "@/lib/workspace";

export type ActionResult = Result | { ok: false; code: "invalid" };

const INVALID = { ok: false, code: "invalid" } as const;
const ids = z.object({ workspaceId: z.uuid() });
const withFact = ids.extend({ factId: z.uuid() });

// Every action validates first, then asks who is calling, then writes; the lib functions filter by that user.
export async function saveAnswersAction(
  workspaceId: string,
  answers: unknown,
): Promise<ActionResult> {
  const parsed = ids
    .extend({ answers: answersSchema })
    .safeParse({ workspaceId, answers });
  if (!parsed.success) return INVALID;
  const { userId } = await requireTester();
  return saveAnswers(userId, parsed.data.workspaceId, parsed.data.answers);
}

export async function confirmFactAction(
  workspaceId: string,
  factId: string,
): Promise<ActionResult> {
  const parsed = withFact.safeParse({ workspaceId, factId });
  if (!parsed.success) return INVALID;
  const { userId } = await requireTester();
  const result = await setFactConfirmed(userId, workspaceId, factId);
  refresh();
  return result;
}

export async function editFactAction(
  workspaceId: string,
  factId: string,
  text: string,
): Promise<ActionResult> {
  const parsed = withFact
    .extend({ text: z.string().trim().min(1).max(200) })
    .safeParse({ workspaceId, factId, text });
  if (!parsed.success) return INVALID;
  const { userId } = await requireTester();
  const result = await rewriteFact(
    userId,
    workspaceId,
    factId,
    parsed.data.text,
  );
  refresh();
  return result;
}

export async function removeFactAction(
  workspaceId: string,
  factId: string,
): Promise<ActionResult> {
  const parsed = withFact.safeParse({ workspaceId, factId });
  if (!parsed.success) return INVALID;
  const { userId } = await requireTester();
  const result = await deleteFact(userId, workspaceId, factId);
  refresh();
  return result;
}

export async function saveCampaignAction(
  workspaceId: string,
  campaign: unknown,
): Promise<ActionResult> {
  const parsed = ids
    .extend({ campaign: campaignEditSchema })
    .safeParse({ workspaceId, campaign });
  if (!parsed.success) return INVALID;
  const { userId } = await requireTester();
  const result = await saveCampaign(userId, workspaceId, parsed.data.campaign);
  refresh();
  return result;
}

// The round itself starts inside generateCreatives (Phase 6).
export async function generateCreativesAction(
  workspaceId: string,
): Promise<ActionResult> {
  const parsed = ids.safeParse({ workspaceId });
  if (!parsed.success) return INVALID;
  const { userId } = await requireTester();
  return generateCreatives(userId, workspaceId);
}

export async function saveChangesAction(
  workspaceId: string,
): Promise<ActionResult> {
  const parsed = ids.safeParse({ workspaceId });
  if (!parsed.success) return INVALID;
  const { userId } = await requireTester();
  return saveChanges(userId, workspaceId);
}
