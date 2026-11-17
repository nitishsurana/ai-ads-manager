import Link from "next/link";
import { RATING_FILTERS, type RatingFilter } from "@/lib/round";

const LABELS: Record<RatingFilter, string> = {
  all: "All",
  approved: "Approved",
  rejected: "Rejected",
  unrated: "Not rated",
};

const ON =
  "inline-flex h-7.5 items-center rounded-md bg-card px-3 text-[13px] font-medium text-foreground no-underline shadow-xs";
const OFF =
  "inline-flex h-7.5 items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground no-underline hover:text-foreground";

export function RatingFilterBar({
  workspaceId,
  value,
}: {
  workspaceId: string;
  value: RatingFilter;
}) {
  return (
    <nav
      aria-label="Filter by rating"
      className="flex gap-0.5 rounded-lg bg-muted p-0.75"
    >
      {RATING_FILTERS.map((filter) => (
        <Link
          key={filter}
          href={
            filter === "all"
              ? `/w/${workspaceId}/library`
              : `/w/${workspaceId}/library?rating=${filter}`
          }
          aria-current={filter === value ? "page" : undefined}
          className={filter === value ? ON : OFF}
        >
          {LABELS[filter]}
        </Link>
      ))}
    </nav>
  );
}
