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

// Posting the same ui_id twice keeps the first message, so a retried step can't duplicate it.
export async function insertMessage(userId: string, message: NewMessage) {
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
    { onConflict: "thread_id,ui_id", ignoreDuplicates: true },
  );
  check(error, "insert message");
}
