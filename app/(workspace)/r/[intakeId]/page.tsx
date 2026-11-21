import { notFound, redirect } from "next/navigation";
import { ReadingScreen } from "@/components/reading/reading-screen";
import { requireTester } from "@/lib/auth";
import { getReadingStatus } from "@/lib/intake/reading";

export default async function Page({ params }: PageProps<"/r/[intakeId]">) {
  const { intakeId } = await params;
  const { userId } = await requireTester();
  const status = await getReadingStatus(userId, intakeId);
  if (!status) notFound();
  if (status.status === "done" && status.workspaceId) {
    redirect(`/w/${status.workspaceId}`);
  }

  return <ReadingScreen key={intakeId} intakeId={intakeId} initial={status} />;
}
