import { notFound } from "next/navigation";
import { ConfirmScreen } from "@/components/confirm/confirm-screen";
import { Stepper } from "@/components/layout/stepper";
import { requireTester } from "@/lib/auth";
import { loadConfirmScreen } from "@/lib/workspace";

export default async function Page({ params }: PageProps<"/w/[id]">) {
  const { id } = await params;
  const { userId } = await requireTester();
  const screen = await loadConfirmScreen(userId, id);
  if (!screen) notFound();

  if (screen.phase === "confirm") {
    return <ConfirmScreen screen={screen} mode="first" />;
  }

  // Phases 6 and 7 branch here on the latest round: Generating while one is queued or running, else the round view.
  return (
    <div className="flex flex-col gap-5 px-12 py-6">
      <Stepper step={2} confirmHref={`/w/${id}/confirm`} />
      <h1 className="m-0 text-[26px] font-semibold tracking-tight">
        Workspace
      </h1>
      <p className="m-0 font-mono text-muted-foreground">{id}</p>
    </div>
  );
}
