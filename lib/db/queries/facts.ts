import "server-only";
import { z } from "zod";
import { createSecretClient } from "../secret";
import { check } from "./error";
import { getThread } from "./threads";

const factRowSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(["offer", "other"]),
  status: z.enum(["pending", "confirmed"]),
});

export type Fact = z.infer<typeof factRowSchema>;
export type FactKind = Fact["kind"];

export async function insertFact(
  userId: string,
  threadId: string,
  fact: { text: string; kind: FactKind },
) {
  if (!(await getThread(userId, threadId))) {
    throw new Error(`db: thread ${threadId} not found for user`);
  }
  const { error } = await createSecretClient()
    .from("facts")
    .insert({ thread_id: threadId, text: fact.text, kind: fact.kind });
  check(error, "insert fact");
}

export async function listFacts(userId: string, threadId: string) {
  if (!(await getThread(userId, threadId))) {
    throw new Error(`db: thread ${threadId} not found for user`);
  }
  const { data, error } = await createSecretClient()
    .from("facts")
    .select("id, text, kind, status")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  check(error, "list facts");
  return z.array(factRowSchema).parse(data ?? []);
}

// Each write applies only to a fact of the given thread, and says whether it did.
async function updateFact(
  userId: string,
  threadId: string,
  factId: string,
  values: { text?: string; status: "pending" | "confirmed" },
) {
  if (!(await getThread(userId, threadId))) {
    throw new Error(`db: thread ${threadId} not found for user`);
  }
  const { data, error } = await createSecretClient()
    .from("facts")
    .update(values)
    .eq("id", factId)
    .eq("thread_id", threadId)
    .select("id");
  check(error, "update fact");
  return (data?.length ?? 0) > 0;
}

export function confirmFact(userId: string, threadId: string, factId: string) {
  return updateFact(userId, threadId, factId, { status: "confirmed" });
}

// An edit puts the fact back to pending.
export function editFact(
  userId: string,
  threadId: string,
  factId: string,
  text: string,
) {
  return updateFact(userId, threadId, factId, { text, status: "pending" });
}

export async function removeFact(
  userId: string,
  threadId: string,
  factId: string,
) {
  if (!(await getThread(userId, threadId))) {
    throw new Error(`db: thread ${threadId} not found for user`);
  }
  const { data, error } = await createSecretClient()
    .from("facts")
    .delete()
    .eq("id", factId)
    .eq("thread_id", threadId)
    .select("id");
  check(error, "remove fact");
  return (data?.length ?? 0) > 0;
}

// Moves a fact to another thread of the same tester as pending, and says whether it did.
export async function moveFactPending(
  userId: string,
  fromThreadId: string,
  toThreadId: string,
  factId: string,
) {
  if (
    !(await getThread(userId, fromThreadId)) ||
    !(await getThread(userId, toThreadId))
  ) {
    throw new Error("db: thread not found for user");
  }
  const { data, error } = await createSecretClient()
    .from("facts")
    .update({ thread_id: toThreadId, status: "pending" })
    .eq("id", factId)
    .eq("thread_id", fromThreadId)
    .select("id");
  check(error, "move fact");
  return (data?.length ?? 0) > 0;
}
