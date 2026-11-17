import "server-only";
import { z } from "zod";
import { step1FailureCodes } from "@/lib/messages";
import type { Json } from "../database.types";
import { createSecretClient } from "../secret";
import { check } from "./error";

const intakeRowSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  url: z.string(),
  product_key: z.string().nullable(),
  status: z.enum(["reading", "failed", "done"]),
  progress: z.unknown(),
  failure_code: z.enum(step1FailureCodes).nullable(),
  workspace_id: z.string().nullable(),
});

export type Intake = {
  id: string;
  threadId: string;
  url: string;
  productKey: string | null;
  status: "reading" | "failed" | "done";
  progress: unknown;
  failureCode: (typeof step1FailureCodes)[number] | null;
  workspaceId: string | null;
};

const COLUMNS =
  "id, thread_id, url, product_key, status, progress, failure_code, workspace_id";

function toIntake(row: unknown): Intake {
  const parsed = intakeRowSchema.parse(row);
  return {
    id: parsed.id,
    threadId: parsed.thread_id,
    url: parsed.url,
    productKey: parsed.product_key,
    status: parsed.status,
    progress: parsed.progress,
    failureCode: parsed.failure_code,
    workspaceId: parsed.workspace_id,
  };
}

export async function createIntake(input: {
  userId: string;
  threadId: string;
  url: string;
}) {
  const { data, error } = await createSecretClient()
    .from("intakes")
    .insert({
      user_id: input.userId,
      thread_id: input.threadId,
      url: input.url,
    })
    .select("id")
    .single();
  check(error, "create intake");
  if (!data) throw new Error("db: create intake returned no row");
  return data.id;
}

export async function getIntake(
  userId: string,
  id: string,
): Promise<Intake | null> {
  const { data, error } = await createSecretClient()
    .from("intakes")
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  check(error, "get intake");
  return data ? toIntake(data) : null;
}

export async function getLatestIntake(
  userId: string,
  threadId: string,
): Promise<Intake | null> {
  const { data, error } = await createSecretClient()
    .from("intakes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  check(error, "get latest intake");
  return data ? toIntake(data) : null;
}

// Every write below applies only while the intake is still reading, and says whether it did.
async function updateWhileReading(
  userId: string,
  id: string,
  values: {
    progress?: Json;
    status?: "failed" | "done";
    failure_code?: string;
    workspace_id?: string;
    product_key?: string;
  },
  olderThan?: Date,
) {
  const now = new Date().toISOString();
  let query = createSecretClient()
    .from("intakes")
    .update({
      ...values,
      progress_at: now,
      ...(values.status ? { finished_at: now } : {}),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "reading");
  if (olderThan) query = query.lt("progress_at", olderThan.toISOString());
  const { data, error } = await query.select("id");
  check(error, "update intake");
  return (data?.length ?? 0) > 0;
}

export function writeIntakeProgress(
  userId: string,
  id: string,
  progress: Json,
) {
  return updateWhileReading(userId, id, { progress });
}

export function touchIntake(userId: string, id: string) {
  return updateWhileReading(userId, id, {});
}

export function failIntake(
  userId: string,
  id: string,
  code: (typeof step1FailureCodes)[number],
) {
  return updateWhileReading(userId, id, {
    status: "failed",
    failure_code: code,
  });
}

export function failStaleIntake(userId: string, id: string, staleMs: number) {
  return updateWhileReading(
    userId,
    id,
    { status: "failed", failure_code: "intake_failed" },
    new Date(Date.now() - staleMs),
  );
}

export function completeIntake(
  userId: string,
  id: string,
  input: { workspaceId: string; productKey: string | null },
) {
  return updateWhileReading(userId, id, {
    status: "done",
    workspace_id: input.workspaceId,
    ...(input.productKey ? { product_key: input.productKey } : {}),
  });
}

export async function findReadingIntakeId(userId: string, threadId: string) {
  const { data, error } = await createSecretClient()
    .from("intakes")
    .select("id")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .eq("status", "reading")
    .limit(1)
    .maybeSingle();
  check(error, "find reading intake");
  return data?.id ?? null;
}

function isJsonObject(
  value: Json,
): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A failed intake's cleanup is done once progress.cleaned is set; the progress JSON has no other writer after failing.
export async function markIntakeCleaned(userId: string, id: string) {
  const client = createSecretClient();
  const { data, error } = await client
    .from("intakes")
    .select("progress")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "failed")
    .maybeSingle();
  check(error, "read intake progress");
  if (!data) return;
  const base =
    data.progress && isJsonObject(data.progress) ? data.progress : {};
  const { error: updateError } = await client
    .from("intakes")
    .update({ progress: { ...base, cleaned: true } })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "failed");
  check(updateError, "mark intake cleaned");
}
