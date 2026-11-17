"use client";

import { ArrowRight, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { generateCreativesAction } from "@/app/(workspace)/w/[id]/actions";
import { failureMessage } from "@/components/confirm/action-message";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages";
import type { RoundView } from "@/lib/round";
import { cn } from "@/lib/utils";
import { CreativeCard } from "./creative-card";
import { downloadZip } from "./downloads";
import { isRated, useCards } from "./use-cards";

type RoundBoardProps = {
  workspaceId: string;
  round: RoundView;
  // The stepper and the title, drawn by the server; the controls sit beside them.
  header: ReactNode;
  brief: ReactNode;
};

// The round view: Next round waits for every rating, no open edit and no pending save.
export function RoundBoard({
  workspaceId,
  round,
  header,
  brief,
}: RoundBoardProps) {
  const router = useRouter();
  const cards = useCards(workspaceId, round.creatives);
  const [starting, startNext] = useTransition();
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const states = round.creatives.map((c) => cards.cards[c.id]);
  const unrated = states.filter((card) => !card || !isRated(card)).length;
  const editing = states.some((card) => card?.editing);
  const saving = states.some((card) => card?.saving);
  const pending = unrated > 0 || editing || saving;

  const progress =
    unrated > 0
      ? `${unrated} left to rate`
      : editing
        ? "Save or cancel your edit"
        : saving
          ? "Saving…"
          : `All ${round.creatives.length} rated`;

  const next = () =>
    startNext(async () => {
      try {
        const result = await generateCreativesAction(workspaceId);
        if (result.ok) {
          setError(null);
          router.refresh();
        } else {
          setError(
            result.code === "invalid"
              ? messages.save_failed
              : failureMessage(result),
          );
        }
      } catch {
        setError(messages.save_failed);
      }
    });

  const zip = async () => {
    setZipping(true);
    setError(null);
    try {
      await downloadZip(round.creatives.map((c) => c.id));
    } catch (failure) {
      console.error(`round ${round.id}: zip failed`, failure);
      setError(messages.export_failed);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-8 pb-12">
      <div className="flex max-w-[1100px] flex-wrap items-end justify-between gap-6">
        {header}
        <div className="flex items-center gap-2.5">
          <span
            aria-live="polite"
            className={cn(
              "inline-flex h-5.5 items-center rounded-full border px-2 text-xs font-medium",
              pending
                ? "border-warning-border bg-warning text-warning-foreground"
                : "border-success-border bg-success-subtle text-success",
            )}
          >
            {progress}
          </span>
          <Button variant="outline" onClick={zip} disabled={zipping}>
            <Download className="size-4" aria-hidden="true" />
            Download round as zip
          </Button>
          <Button size="lg" disabled={pending || starting} onClick={next}>
            {starting ? "Starting…" : "Next round"}
            {!starting && <ArrowRight className="size-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {error && (
        <div className="max-w-[1100px]">
          <Alert tone="error" message={error} />
        </div>
      )}

      <div className="max-w-[1100px]">{brief}</div>

      <div className="grid max-w-[1100px] grid-cols-3 items-start gap-6">
        {round.creatives.map((creative) => {
          const card = cards.cards[creative.id];
          return card ? (
            <CreativeCard
              key={creative.id}
              workspaceId={workspaceId}
              creative={creative}
              card={card}
              rev={() => cards.revOf(creative.id)}
              onApprove={() => cards.approve(creative.id)}
              onReject={() => cards.reject(creative.id)}
              onToggleTag={(tag) => cards.toggleTag(creative.id, tag)}
              onNote={(note) => cards.setNote(creative.id, note)}
              onBlur={() => cards.flush(creative.id)}
              onStartEdit={() => cards.startEdit(creative.id)}
              onCancelEdit={() => cards.stopEdit(creative.id)}
              onEdited={(rev) => cards.edited(creative.id, rev)}
            />
          ) : null;
        })}
      </div>
    </div>
  );
}
