"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { AdminCreative, AdminRound } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { BrandKitChanges } from "./brand-kit-changes";
import { DetailCard } from "./detail-card";
import { COLUMNS, dateLabel, durationLabel, money } from "./format";

const MARK = {
  approve: ["✓", "Approved", "bg-success-subtle text-success"],
  reject: ["✕", "Rejected", "bg-destructive-subtle text-destructive"],
  none: ["–", "Not rated", "bg-muted text-muted-foreground"],
} as const;

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  failed: "Failed",
  timed_out: "Timed out",
  no_pass: "No creative passed",
};

function judgeTone(mean: number) {
  if (mean <= 2) return "bg-destructive-subtle text-destructive";
  return mean >= 4 ? "bg-success-subtle text-success" : "bg-muted";
}

function reasons(creatives: AdminCreative[]) {
  return creatives
    .flatMap((c) => {
      const text = [c.tags.join(", "), c.note ? `“${c.note}”` : ""]
        .filter(Boolean)
        .join(" · ");
      return text ? [`#${c.n} ${text}`] : [];
    })
    .join(" · ");
}

export function RoundRow({ round }: { round: AdminRound }) {
  const [open, setOpen] = useState(false);
  const roundText =
    round.n === null
      ? "No rounds yet"
      : `Round ${round.n}${round.attempt > 1 ? ` (attempt ${round.attempt})` : ""}`;
  const label = `${round.title}, ${roundText.toLowerCase()}`;
  const status = STATUS_LABEL[round.status];
  const reasonText = reasons(round.creatives);
  const edits = round.creatives.reduce((sum, c) => sum + c.edits, 0);

  return (
    <>
      <tr className="border-b border-border text-[13.5px]">
        <td className="py-3 pl-2">
          <button
            type="button"
            aria-label={`${open ? "Hide" : "Show"} details for ${label}`}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn("size-4 transition-transform", open && "rotate-90")}
            />
          </button>
        </td>
        <td className="px-1.5 py-3">
          <span className="flex flex-col">
            <span className="flex items-center gap-1.5 font-medium">
              {round.title}
              {round.deleted && (
                <span className="inline-flex h-5 items-center rounded bg-destructive-subtle px-1.5 text-[11px] font-semibold text-destructive">
                  Deleted
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">{round.store}</span>
          </span>
        </td>
        <td className="px-1.5 py-3">
          <span className="flex flex-col">
            <span>{roundText}</span>
            <time
              dateTime={round.startedAt}
              className="text-xs text-muted-foreground"
            >
              {dateLabel(round.startedAt)}
            </time>
            {status && (
              <span className="text-xs text-destructive">{status}</span>
            )}
          </span>
        </td>
        <td className="px-1.5 py-3">
          <span className="flex gap-1">
            {round.creatives.map((c) => (
              <span
                key={c.n}
                className="block w-7 overflow-hidden rounded-[3px] border border-border bg-muted"
              >
                {c.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.previewUrl}
                    alt=""
                    className="aspect-[9/16] w-full object-cover"
                  />
                )}
              </span>
            ))}
          </span>
        </td>
        <td className="px-1.5 py-3">
          <span className="flex gap-1">
            {round.creatives.map((c) => {
              const [mark, text, tone] = MARK[c.rating ?? "none"];
              return (
                <span
                  key={c.n}
                  role="img"
                  aria-label={`Creative ${c.n}: ${text}`}
                  className={cn(
                    "inline-flex size-5.5 items-center justify-center rounded-full text-xs font-bold",
                    tone,
                  )}
                >
                  {mark}
                </span>
              );
            })}
          </span>
        </td>
        <td className="px-1.5 py-3">
          <span className="flex gap-1">
            {round.creatives.map((c) =>
              c.judge ? (
                <span
                  key={c.n}
                  title={c.judge.lowConfidence ? "Low confidence" : undefined}
                  className={cn(
                    "inline-flex h-5.5 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-xs font-medium",
                    judgeTone(c.judge.mean),
                    c.judge.lowConfidence && "ring-1 ring-warning-border",
                  )}
                >
                  {c.judge.mean.toFixed(1)}
                  {c.judge.lowConfidence && (
                    <>
                      <span aria-hidden="true">*</span>
                      <span className="sr-only">, low confidence</span>
                    </>
                  )}
                </span>
              ) : (
                <span key={c.n} className="text-muted-foreground">
                  –
                </span>
              ),
            )}
          </span>
        </td>
        <td className="max-w-80 px-1.5 py-3 text-[13px] text-muted-foreground">
          <span className="line-clamp-3" title={reasonText}>
            {reasonText || "—"}
          </span>
        </td>
        <td className="px-1.5 py-3 text-right tabular-nums">{edits}</td>
        <td className="py-3 pr-4 pl-1.5 text-right font-mono text-[13px]">
          {money(round.cost)}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border bg-card">
          <td colSpan={COLUMNS} className="pr-4 pb-4 pl-14">
            <div className="grid grid-cols-3 gap-3">
              {round.creatives.map((c) => (
                <DetailCard key={c.n} creative={c} tester={round.tester} />
              ))}
              {round.creatives.length === 0 && (
                <p className="m-0 text-muted-foreground">
                  {round.n === null
                    ? "No rounds yet."
                    : "No creatives were stored for this round."}
                </p>
              )}
            </div>
            <div className="mt-3">
              <BrandKitChanges changes={round.brandChanges} />
            </div>
            <p className="m-0 mt-2.5 text-xs text-muted-foreground">
              {[
                round.durationS === null
                  ? null
                  : `Generated in ${durationLabel(round.durationS)}`,
                round.n === null ? null : `brief v${round.briefVersion}`,
                round.attempt > 1 ? `attempt ${round.attempt}` : null,
                round.n === null ? null : `round cost ${money(round.cost)}`,
                round.setupCost > 0
                  ? `other workspace costs (reading, chat) ${money(round.setupCost)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}
