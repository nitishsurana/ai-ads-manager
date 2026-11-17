import { notFound } from "next/navigation";
import { ConfirmScreen } from "@/components/confirm/confirm-screen";
import { Stepper } from "@/components/layout/stepper";
import { RoundScreen } from "@/components/rounds/round-screen";
import { requireTester } from "@/lib/auth";
import { getLatestRoundStatus } from "@/lib/round";
import { loadConfirmScreen } from "@/lib/workspace";

export default async function Page({ params }: PageProps<"/w/[id]">) {
  const { id } = await params;
  const { userId } = await requireTester();
  const screen = await loadConfirmScreen(userId, id);
  if (!screen) notFound();

  if (screen.phase === "confirm") {
    return <ConfirmScreen screen={screen} mode="first" />;
  }

  // Phase 7 replaces RoundScreen with the Generating and Round views.
  const round = await getLatestRoundStatus(userId, id);
  return (
    <div className="flex flex-col gap-5 px-12 py-6">
      <Stepper step={2} confirmHref={`/w/${id}/confirm`} />
      {round && <RoundScreen key={round.id} workspaceId={id} initial={round} />}
    </div>
  );
}
