import Link from "next/link";
import { messages } from "@/lib/messages";
import type { LibraryRound, RatingFilter } from "@/lib/round";
import { DownloadZipButton } from "./downloads";
import { LibraryRow } from "./library-row";
import { RatingFilterBar } from "./rating-filter";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function summary(round: LibraryRound) {
  const rated = (rating: "approve" | "reject" | null) =>
    round.creatives.filter((creative) => creative.rating === rating).length;
  return [
    [rated("approve"), "approved"],
    [rated("reject"), "rejected"],
    [rated(null), "not rated"],
  ]
    .filter(([n]) => n)
    .map(([n, label]) => `${n} ${label}`)
    .join(" · ");
}

type LibraryScreenProps = {
  workspaceId: string;
  filter: RatingFilter;
  hasRounds: boolean;
  rounds: LibraryRound[];
};

export function LibraryScreen({
  workspaceId,
  filter,
  hasRounds,
  rounds,
}: LibraryScreenProps) {
  const creatives = rounds.reduce(
    (sum, round) => sum + round.creatives.length,
    0,
  );
  return (
    <div className="flex w-full max-w-[1100px] flex-col gap-6 px-8 pb-12">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Library</h1>
          <p className="m-0 text-muted-foreground">
            Every round in this workspace, newest first.
            {hasRounds &&
              ` ${count(rounds.length, "round")} · ${count(creatives, "creative")}.`}
          </p>
        </div>
        {hasRounds && (
          <RatingFilterBar workspaceId={workspaceId} value={filter} />
        )}
      </div>
      {!hasRounds && (
        <p className="m-0 rounded-xl border border-border bg-card px-4 py-10 text-center text-muted-foreground shadow-xs">
          {messages.library_empty}{" "}
          <Link
            href={`/w/${workspaceId}`}
            className="text-primary-text hover:underline"
          >
            Back to the workspace
          </Link>
        </p>
      )}
      {hasRounds && rounds.length === 0 && (
        <p className="m-0 rounded-xl border border-border bg-card px-4 py-10 text-center text-muted-foreground shadow-xs">
          {messages.library_no_match}
        </p>
      )}
      {rounds.map((round) => (
        <section
          key={round.id}
          aria-label={`Round ${round.n}`}
          className="flex flex-col gap-2.5"
        >
          <div className="flex items-center gap-2.5">
            <h2 className="m-0 text-base font-semibold tracking-tight">
              Round {round.n}
            </h2>
            <span className="text-xs text-muted-foreground">
              {dateFormat.format(new Date(round.at))} · brief v
              {round.briefVersion}
            </span>
            <span className="inline-flex h-5.5 items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
              {summary(round)}
            </span>
            <span className="ml-auto">
              <DownloadZipButton creativeIds={round.allCreativeIds} />
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {round.creatives.map((creative, index) => (
              <LibraryRow
                key={creative.id}
                creative={creative}
                last={index === round.creatives.length - 1}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
