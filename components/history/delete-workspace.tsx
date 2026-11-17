"use client";

import { useState, useTransition } from "react";
import { Trash } from "lucide-react";
import { deleteWorkspaceAction } from "@/app/(full)/history/actions";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages";

type DeleteWorkspaceProps = {
  id: string;
  title: string;
  rounds: number;
};

export function DeleteWorkspace({ id, title, rounds }: DeleteWorkspaceProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startDelete] = useTransition();
  const removed =
    rounds === 0
      ? "and its confirmed details"
      : `and its ${rounds} ${rounds === 1 ? "round" : "rounds"}`;

  // not_found means it is already gone; the refreshed list no longer shows it.
  const confirm = () =>
    startDelete(async () => {
      try {
        const result = await deleteWorkspaceAction(id);
        if (result.ok || result.code === "not_found") setOpen(false);
        else setError(messages.delete_failed);
      } catch {
        setError(messages.delete_failed);
      }
    });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Delete ${title}`}>
          <Trash className="size-4" aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
        <AlertDialogDescription>
          <strong className="font-semibold text-foreground">{title}</strong>{" "}
          {removed} will be removed from this browser. PNGs you’ve downloaded
          aren’t affected. This can’t be undone.
        </AlertDialogDescription>
        {error && <Alert tone="error" message={error} />}
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={confirm}>
            Delete workspace
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
