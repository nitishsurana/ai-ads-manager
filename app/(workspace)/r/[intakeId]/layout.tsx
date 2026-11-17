import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireTester } from "@/lib/auth";
import { readIntake } from "@/lib/intake/workflow";

export default async function ReadingLayout({
  children,
  params,
}: LayoutProps<"/r/[intakeId]">) {
  const { intakeId } = await params;
  const { userId } = await requireTester();
  const intake = await readIntake(userId, intakeId);
  if (!intake) notFound();

  return <WorkspaceShell threadId={intake.threadId}>{children}</WorkspaceShell>;
}
