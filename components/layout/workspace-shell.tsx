import type { ReactNode } from "react";
import { ChatPane } from "@/components/chat/chat-pane";
import { cn } from "@/lib/utils";

type WorkspaceShellProps = {
  threadId: string;
  // The screen lays out its own main area (the confirm screen's sticky bottom bar needs the full width).
  flush?: boolean;
  children: ReactNode;
};

export function WorkspaceShell({
  threadId,
  flush = false,
  children,
}: WorkspaceShellProps) {
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
      <main
        className={cn(
          "min-w-0 flex-1",
          flush ? "flex flex-col pt-6" : "px-12 py-18",
        )}
      >
        {children}
      </main>
    </div>
  );
}
