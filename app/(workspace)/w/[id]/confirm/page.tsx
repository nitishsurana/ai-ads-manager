import { notFound, redirect } from "next/navigation";
import { ConfirmScreen } from "@/components/confirm/confirm-screen";
import { requireTester } from "@/lib/auth";
import { loadConfirmScreen } from "@/lib/workspace";

export default async function Page({ params }: PageProps<"/w/[id]/confirm">) {
  const { id } = await params;
  const { userId } = await requireTester();
  const screen = await loadConfirmScreen(userId, id);
  if (!screen) notFound();
  // Before the first round the confirm screen is the workspace itself.
  if (screen.phase === "confirm") redirect(`/w/${id}`);

  return <ConfirmScreen screen={screen} mode="edit" />;
}
