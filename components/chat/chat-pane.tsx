import { loadChatPane } from "@/lib/chat";
import { requireTester } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ChatHistory } from "./chat-history";
import { ChatSession } from "./chat-session";

export async function ChatPane({ threadId }: { threadId: string }) {
  const { userId, name } = await requireTester();
  const pane = await loadChatPane(userId, threadId);
  if (!pane) notFound();

  return (
    <ChatSession
      threadId={threadId}
      mode={pane.mode}
      name={name}
      empty={pane.rows.length === 0}
      knownIds={pane.rows.map((row) => row.id)}
    >
      <ChatHistory
        rows={pane.rows}
        campaign={pane.campaign}
        facts={pane.facts}
        confirmHref={pane.confirmHref}
      />
    </ChatSession>
  );
}
