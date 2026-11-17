"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TAB =
  "inline-flex h-7.5 items-center rounded-md px-3 text-[13px] font-medium no-underline";
const ON = "bg-card text-foreground shadow-xs";
const OFF = "text-muted-foreground hover:text-foreground";

// Only inside a workspace; History and Admin have no tabs.
export function WorkspaceTabs() {
  const { id } = useParams<{ id?: string }>();
  const pathname = usePathname();
  if (!id) return null;
  const library = pathname === `/w/${id}/library`;
  return (
    <nav
      aria-label="Workspace"
      className="ml-3 flex gap-0.5 rounded-lg bg-muted p-0.75"
    >
      <Link
        href={`/w/${id}`}
        aria-current={library ? undefined : "page"}
        className={cn(TAB, library ? OFF : ON)}
      >
        Workspace
      </Link>
      <Link
        href={`/w/${id}/library`}
        aria-current={library ? "page" : undefined}
        className={cn(TAB, library ? ON : OFF)}
      >
        Library
      </Link>
    </nav>
  );
}
