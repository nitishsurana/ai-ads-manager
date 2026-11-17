import { notFound } from "next/navigation";
import { LibraryScreen } from "@/components/library/library-screen";
import { requireTester } from "@/lib/auth";
import { getWorkspacePhase } from "@/lib/db/queries";
import { loadLibrary, ratingFilterSchema } from "@/lib/round";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/w/[id]/library">) {
  const { id } = await params;
  const { userId } = await requireTester();
  if (!(await getWorkspacePhase(userId, id))) notFound();

  const filter = ratingFilterSchema.parse((await searchParams).rating);
  const { hasRounds, rounds } = await loadLibrary(userId, id, filter);
  return (
    <LibraryScreen
      workspaceId={id}
      filter={filter}
      hasRounds={hasRounds}
      rounds={rounds}
    />
  );
}
