import "server-only";
import { z } from "zod";
import { createSecretClient } from "../secret";
import { check } from "./error";
import { getThread } from "./threads";

const factRowSchema = z.object({
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
    .select("text, kind, status")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  check(error, "list facts");
  return z.array(factRowSchema).parse(data ?? []);
}
