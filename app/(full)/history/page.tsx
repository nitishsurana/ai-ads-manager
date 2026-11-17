import Link from "next/link";
import { Plus } from "lucide-react";
import { HISTORY_GRID, WorkspaceRow } from "@/components/history/workspace-row";
import { buttonVariants } from "@/components/ui/button";
import { requireTester } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { loadHistory } from "@/lib/workspace";

export default async function Page() {
  const { userId } = await requireTester();
  const items = await loadHistory(userId);

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">History</h1>
          <p className="m-0 text-muted-foreground">
            Workspaces saved in this browser. Clearing browser data removes
            them.
          </p>
        </div>
        <Link href="/" className={cn(buttonVariants(), "no-underline")}>
          <Plus className="size-4" aria-hidden="true" />
          New workspace
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {items.length === 0 ? (
          <p className="m-0 px-4 py-10 text-center text-muted-foreground">
            No workspaces yet. Paste a product link to start one.
          </p>
        ) : (
          <>
            <div
              aria-hidden="true"
              className={cn(
                HISTORY_GRID,
                "border-b border-border py-2.5 text-xs font-medium text-muted-foreground",
              )}
            >
              <span>Product</span>
              <span>Store</span>
              <span>Last round</span>
              <span>Updated</span>
              <span className="w-[106px]" />
            </div>
            <ul aria-label="Workspaces" className="m-0 list-none p-0">
              {items.map((item) => (
                <WorkspaceRow key={item.id} item={item} />
              ))}
            </ul>
          </>
        )}
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        Only this browser’s workspaces are listed. Downloaded PNGs stay on your
        computer.
      </p>
    </div>
  );
}
