import { ChatPane } from "@/components/chat/chat-pane";
import { TopBar } from "@/components/layout/top-bar";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar tester="Tester" />
      <div className="flex flex-1 items-stretch">
        <aside
          aria-label="Chat"
          className="w-[380px] shrink-0 border-r border-border bg-card"
        >
          <div className="sticky top-0 h-[calc(100vh-3.5rem)]">
            <ChatPane />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-12 py-18">{children}</main>
      </div>
    </div>
  );
}
