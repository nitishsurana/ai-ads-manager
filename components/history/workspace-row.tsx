import Link from "next/link";
import type { HistoryItem } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { DeleteWorkspace } from "./delete-workspace";

export const HISTORY_GRID =
  "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 px-4";

function initials(store: string) {
  return store
    .split(/\s+/)
    .filter((word) => /^[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function WorkspaceRow({ item }: { item: HistoryItem }) {
  return (
    <li
      className={cn(
        HISTORY_GRID,
        "border-b border-border bg-card py-3 text-[13.5px] last:border-b-0",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {item.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex size-full items-center justify-center text-[15px] font-semibold text-muted-foreground"
            >
              {initials(item.store)}
            </div>
          )}
        </div>
        <span className="truncate font-medium">{item.title}</span>
      </div>
      <span className="truncate">{item.store}</span>
      <span>
        <span
          className={cn(
            "inline-flex h-5.5 items-center rounded-full px-2 text-xs font-medium",
            item.round
              ? "bg-muted text-muted-foreground"
              : "border border-border",
          )}
        >
          {item.round ? `Round ${item.round}` : "Not generated yet"}
        </span>
      </span>
      <time dateTime={item.updatedAt} className="text-muted-foreground">
        {item.updatedLabel}
      </time>
      <div className="flex w-[106px] items-center justify-end gap-1">
        <Link
          href={`/w/${item.id}`}
          aria-label={`Open ${item.title}`}
          className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground no-underline hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Open
        </Link>
        <DeleteWorkspace id={item.id} title={item.title} rounds={item.round} />
      </div>
    </li>
  );
}
