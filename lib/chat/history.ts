import "server-only";
import type { ModelMessage } from "ai";
import type { ChatRow } from "./types";

const MAX_MESSAGES = 20;

export function toModelMessages(rows: ChatRow[]): ModelMessage[] {
  const messages = rows
    .filter((row) => row.kind === "chat" && row.role !== "system")
    .flatMap((row) => {
      const text = row.parts
        .flatMap((part) => (part.type === "text" ? [part.text] : []))
        .join("\n");
      return text && (row.role === "user" || row.role === "assistant")
        ? [{ role: row.role, content: text }]
        : [];
    })
    .slice(-MAX_MESSAGES);
  const firstUser = messages.findIndex((message) => message.role === "user");
  return firstUser < 0 ? [] : messages.slice(firstUser);
}
