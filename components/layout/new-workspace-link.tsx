"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";

// Only inside a workspace or a reading; History has its own button and `/` is the new workspace.
export function NewWorkspaceLink() {
  const { id, intakeId } = useParams<{ id?: string; intakeId?: string }>();
  if (!id && !intakeId) return null;
  return (
    <Link
      href="/"
      className="inline-flex h-8.5 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-inherit no-underline hover:bg-muted"
    >
      <Plus className="size-4" aria-hidden="true" />
      New workspace
    </Link>
  );
}
