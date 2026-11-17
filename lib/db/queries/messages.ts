import "server-only";
import type { Json } from "../database.types";
import { createSecretClient } from "../secret";
import { check } from "./error";
import { getThread } from "./threads";

export type NewMessage = {
  threadId: string;
  uiId: string;
  role: "user" | "assistant" | "system";
  kind: "chat" | "research" | "brief_update" | "status" | "divider" | "summary";
  parts: NonNullable<Json>;
};

// Posting the same ui_id twice keeps the first message, so a retried step can't duplicate it. Says whether this call inserted it.
export async function insertMessage(userId: string, message: NewMessage) {
  if (!(await getThread(userId, message.threadId))) {
    throw new Error(`db: thread ${message.threadId} not found for user`);
  }
  const { data, error } = await createSecretClient()
    .from("messages")
    .upsert(
      {
        thread_id: message.threadId,
        ui_id: message.uiId,
        role: message.role,
        kind: message.kind,
        parts: message.parts,
      },
      { onConflict: "thread_id,ui_id", ignoreDuplicates: true },
    )
    .select("id");
  check(error, "insert message");
  return (data?.length ?? 0) > 0;
}

export async function moveMessage(
  userId: string,
  fromThreadId: string,
  toThreadId: string,
  uiId: string,
) {
  if (
    !(await getThread(userId, fromThreadId)) ||
    !(await getThread(userId, toThreadId))
  ) {
    throw new Error("db: thread not found for user");
  }
  const { error } = await createSecretClient()
    .from("messages")
    .update({ thread_id: toThreadId })
    .eq("thread_id", fromThreadId)
    .eq("ui_id", uiId);
  check(error, "move message");
}

export async function listMessages(userId: string, threadId: string) {
  if (!(await getThread(userId, threadId))) {
    throw new Error(`db: thread ${threadId} not found for user`);
  }
  const { data, error } = await createSecretClient()
    .from("messages")
    .select("ui_id, role, kind, parts")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  check(error, "list messages");
  return data ?? [];
}

// Replaces the message with this ui_id, so a later write updates what the first one said.
export async function upsertMessage(userId: string, message: NewMessage) {
  if (!(await getThread(userId, message.threadId))) {
    throw new Error(`db: thread ${message.threadId} not found for user`);
  }
  const { error } = await createSecretClient().from("messages").upsert(
    {
      thread_id: message.threadId,
      ui_id: message.uiId,
      role: message.role,
      kind: message.kind,
      parts: message.parts,
    },
    { onConflict: "thread_id,ui_id" },
  );
  check(error, "upsert message");
}
