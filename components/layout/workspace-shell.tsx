import type { ReactNode } from "react";
import { ChatPane } from "@/components/chat/chat-pane";

type WorkspaceShellProps = {
  threadId: string;
  children: ReactNode;
};

export function WorkspaceShell({ threadId, children }: WorkspaceShellProps) {
  return (
    <div className="flex flex-1 items-stretch">
      <aside
        aria-label="Chat"
        className="w-[380px] shrink-0 border-r border-border bg-card"
      >
        <div className="sticky top-0 h-[calc(100vh-3.5rem)]">
          <ChatPane threadId={threadId} />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-12 py-18">{children}</main>
    </div>
  );
}
