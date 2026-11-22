import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmScreen } from "@/components/confirm/confirm-screen";
import { Stepper } from "@/components/layout/stepper";
import { BriefPanel } from "@/components/rounds/brief-panel";
import { GeneratingScreen } from "@/components/rounds/generating-screen";
import { RoundBoard } from "@/components/rounds/round-board";
import { elapsedLabel } from "@/components/rounds/stages";
import { requireTester } from "@/lib/auth";
import { loadBriefPanel } from "@/lib/brief";
import { loadRoundScreen } from "@/lib/round";
import { loadConfirmScreen } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export default async function Page({ params }: PageProps<"/w/[id]">) {
  const { id } = await params;
  const { userId } = await requireTester();
  const screen = await loadConfirmScreen(userId, id);
  if (!screen) notFound();

  if (screen.phase === "confirm") {
    return <ConfirmScreen screen={screen} mode="first" />;
  }

  const round = await loadRoundScreen(userId, id);
  // A rounds-phase workspace always has a round; until one exists, only the way back to step 1 shows.
  if (round.kind === "none") {
    return (
      <div className="px-8 pb-12">
        <Stepper step={2} confirmHref={`/w/${id}/confirm`} />
      </div>
    );
  }
  if (round.kind === "generating") {
    return (
      <GeneratingScreen
        key={round.status.id}
        workspaceId={id}
        initial={round.status}
      />
    );
  }

  const { view } = round;
  const brief = await loadBriefPanel(userId, id);
  const count = view.creatives.length;
  return (
    <RoundBoard
      key={view.id}
      workspaceId={id}
      round={view}
      header={
        <div className="flex flex-col gap-3">
          <Stepper step={3} confirmHref={`/w/${id}/confirm`} />
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="m-0 text-2xl font-semibold tracking-tight">
              Round {view.n}
            </h1>
            <Link
              href={`/w/${id}/confirm`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "self-center no-underline",
              )}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit brand kit
            </Link>
            <span className="text-xs text-muted-foreground">
              {count} {count === 1 ? "creative" : "creatives"}
              {view.madeInS !== null &&
                ` · made in ${elapsedLabel(view.madeInS)}`}
              {` · brief v${view.briefVersion}`}
              {view.campaign && ` · ${view.campaign}`}
            </span>
            {view.n > 1 && (
              <Link
                href={`/w/${id}/library`}
                className="text-xs text-primary-text hover:underline"
              >
                Round {view.n - 1} in Library
              </Link>
            )}
          </div>
        </div>
      }
      brief={brief && <BriefPanel workspaceId={id} data={brief} />}
    />
  );
}
