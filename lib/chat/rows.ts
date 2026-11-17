import "server-only";
import { listMessages } from "@/lib/db/queries";
import { messageRowSchema, type ChatRow } from "./types";

export async function loadRows(
  userId: string,
  threadId: string,
): Promise<ChatRow[]> {
  const data = await listMessages(userId, threadId);
  return data.flatMap((row) => {
    const parsed = messageRowSchema.safeParse(row);
    if (!parsed.success) {
      console.error(`chat: message ${row.ui_id} has unreadable parts`);
      return [];
    }
    const { ui_id, role, kind, parts } = parsed.data;
    return [{ id: ui_id, role, kind, parts }];
  });
}
