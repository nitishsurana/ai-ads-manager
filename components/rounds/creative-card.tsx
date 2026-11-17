"use client";

import { Check, Download, Pencil, X } from "lucide-react";
import { useState } from "react";
import { editCreativeAction } from "@/app/(workspace)/w/[id]/round-actions";
import { messages } from "@/lib/messages";
import type { CreativeView } from "@/lib/round";
import { failureText } from "@/lib/round/result";
import { cn } from "@/lib/utils";
import { CreativeEditor } from "./creative-editor";
import { downloadPng } from "./downloads";
import { EditLimits } from "./edit-limits";
import { RejectReason } from "./reject-reason";
import { angleLabel } from "./stages";
import type { CardState } from "./use-cards";
import type { Tag } from "@/lib/round/feedback/tags";

const CHOICE =
  "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border text-sm font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type CreativeCardProps = {
  workspaceId: string;
  creative: CreativeView;
  card: CardState;
  rev: () => number;
  onApprove: () => void;
  onReject: () => void;
  onToggleTag: (tag: Tag) => void;
  onNote: (note: string) => void;
  onBlur: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEdited: (rev: number) => void;
};

export function CreativeCard({
  workspaceId,
  creative,
  card,
  rev,
  onApprove,
  onReject,
  onToggleTag,
  onNote,
  onBlur,
  onStartEdit,
  onCancelEdit,
  onEdited,
}: CreativeCardProps) {
  const [headline, setHeadline] = useState(creative.copy.headline);
  const [cta, setCta] = useState(creative.copy.cta);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const approved = card.choice === "approve";
  const rejected = card.choice === "reject";

  const startEdit = () => {
    setHeadline(creative.copy.headline);
    setCta(creative.copy.cta);
    setEditError(null);
    onStartEdit();
  };

  const save = async () => {
    setSaving(true);
    setEditError(null);
    try {
      const result = await editCreativeAction({
        workspaceId,
        creativeId: creative.id,
        rev: rev(),
        headline,
        cta,
      });
      if (result.ok) onEdited(result.rev);
      else setEditError(failureText(result));
    } catch (error) {
      console.error(`edit ${creative.id} failed`, error);
      setEditError(messages.save_failed);
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadPng(creative.id);
    } catch (error) {
      console.error(`download ${creative.id} failed`, error);
      setDownloadError(messages.export_failed);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card font-sans text-sm text-foreground shadow-xs">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-[13px] font-semibold">Creative {creative.n}</span>
        <span className="inline-flex h-5.5 items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
          {angleLabel(creative.angle)}
        </span>
        <span className="ml-auto flex gap-1">
          <button
            type="button"
            aria-label="Edit headline and CTA"
            onClick={startEdit}
            disabled={card.editing}
            className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <Download className="size-3.5" aria-hidden="true" />
            PNG
          </button>
        </span>
      </header>
      {downloadError && (
        <p role="alert" className="m-0 px-3 pb-2 text-xs text-destructive">
          {downloadError}
        </p>
      )}
      <div className="border-y border-border bg-stage">
        {card.editing ? (
          <CreativeEditor
            creative={creative}
            headline={headline}
            cta={cta}
            onHeadline={setHeadline}
            onCta={setCta}
          />
        ) : (
          creative.previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a signed storage URL
            <img
              src={creative.previewUrl}
              alt={`Creative ${creative.n}: ${creative.copy.headline}. Button: ${creative.copy.cta}`}
              className="block aspect-[9/16] w-full"
            />
          )
        )}
      </div>
      {card.editing && (
        <EditLimits
          headline={headline}
          cta={cta}
          eyebrow={creative.copy.eyebrow}
          error={editError}
          saving={saving}
          blocked={card.saving}
          onCancel={onCancelEdit}
          onSave={save}
        />
      )}
      <div className="flex flex-col gap-3 p-3">
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={approved}
            disabled={saving}
            onClick={onApprove}
            className={cn(
              CHOICE,
              approved
                ? "border-success-border bg-success-subtle text-success"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
            Approve
          </button>
          <button
            type="button"
            aria-pressed={rejected}
            disabled={saving}
            onClick={onReject}
            className={cn(
              CHOICE,
              rejected
                ? "border-destructive-border bg-destructive-subtle text-destructive"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
            Reject
          </button>
        </div>
        {rejected && (
          <RejectReason
            tags={card.tags}
            note={card.note}
            onToggleTag={onToggleTag}
            onNote={onNote}
            onBlur={onBlur}
          />
        )}
        {approved && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">
              What works?{" "}
              <span className="text-xs font-normal text-muted-foreground">
                Optional
              </span>
            </span>
            <input
              value={card.note}
              maxLength={500}
              onChange={(event) => onNote(event.target.value)}
              onBlur={onBlur}
              placeholder="e.g. the warm light feels festive"
              className="block h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-primary-subtle"
            />
          </label>
        )}
        {card.error && (
          <p role="alert" className="m-0 text-xs text-destructive">
            {card.error}
          </p>
        )}
      </div>
    </article>
  );
}
