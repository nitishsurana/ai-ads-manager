import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireTester } from "@/lib/auth";
import { getWorkspaceThreadId } from "@/lib/db/queries";

export default async function WorkspaceDetailLayout({
  children,
  params,
}: LayoutProps<"/w/[id]">) {
  const { id } = await params;
  const { userId } = await requireTester();
  const threadId = await getWorkspaceThreadId(userId, id);
  if (!threadId) notFound();

  return (
    <WorkspaceShell threadId={threadId} flush>
      {children}
    </WorkspaceShell>
  );
}
