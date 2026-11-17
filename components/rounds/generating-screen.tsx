"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateCreativesAction } from "@/app/(workspace)/w/[id]/actions";
import { failureMessage } from "@/components/confirm/action-message";
import { Stepper } from "@/components/layout/stepper";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages";
import type { RoundStatusView } from "@/lib/round/schema";
import { CreativeSkeleton } from "./creative-skeleton";
import { StageTile } from "./stage-tile";
import { angleLabel, elapsedLabel, progressShare, stageViews } from "./stages";
import { useNow, useRoundPoll } from "./use-round-poll";

const SKELETONS = [1, 2, 3];

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

type GeneratingScreenProps = { workspaceId: string; initial: RoundStatusView };

// Round progress, and the round's failure when it didn't produce creatives. The server picks this screen for a round that isn't done.
export function GeneratingScreen({
  workspaceId,
  initial,
}: GeneratingScreenProps) {
  const router = useRouter();
  const status = useRoundPoll(initial);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrying, startRetry] = useTransition();
  const active = status.status === "queued" || status.status === "running";
  const waitsToRetry = status.retryAt !== null;
  const now = useNow(active || waitsToRetry);

  const retryIn =
    status.retryAt && now !== null
      ? Math.max(0, Math.ceil((Date.parse(status.retryAt) - now) / 1000))
      : status.retryAt
        ? null
        : 0;
  const waiting = retryIn === null || retryIn > 0;
  const elapsed =
    status.runningAt && now !== null
      ? Math.max(0, Math.floor((now - Date.parse(status.runningAt)) / 1000))
      : null;

  const retry = () =>
    startRetry(async () => {
      try {
        const result = await generateCreativesAction(workspaceId);
        if (result.ok) {
          setRetryError(null);
          router.refresh();
        } else {
          setRetryError(
            result.code === "invalid"
              ? messages.save_failed
              : failureMessage(result),
          );
        }
      } catch {
        setRetryError(messages.save_failed);
      }
    });

  const retryLabel = retrying
    ? "Starting…"
    : status.status !== "timed_out"
      ? "Try again"
      : retryIn !== null && retryIn > 0
        ? `Retry in ${clock(retryIn)}`
        : "Retry now";

  return (
    <div className="flex flex-col gap-5 px-8 pb-12">
      <div className="flex max-w-[1100px] flex-col gap-3">
        <Stepper step={2} confirmHref={`/w/${workspaceId}/confirm`} />
        <div className="flex items-baseline gap-3">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">
            Round {status.n}
            {status.attempt > 1 ? `, attempt ${status.attempt}` : ""}
          </h1>
          <span className="text-xs text-muted-foreground">
            Up to 3 creatives{status.campaign && ` · ${status.campaign}`}
          </span>
        </div>
      </div>

      <section className="flex max-w-[1100px] flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
        {active && (
          <>
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Making your creatives</span>
              <span className="text-xs text-muted-foreground">
                {status.status === "queued"
                  ? "Waiting to start"
                  : elapsed === null
                    ? "Starting"
                    : `${elapsedLabel(elapsed)} so far · usually under 3 min`}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Round progress"
              aria-valuenow={progressShare(status)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${progressShare(status)}%` }}
              />
            </div>
          </>
        )}
        {status.message && (
          <Alert
            tone="error"
            message={status.message}
            detail={
              status.status === "timed_out"
                ? `Your confirmed details and brief are saved. Retrying starts round ${status.n} again.`
                : undefined
            }
          >
            <Button onClick={retry} disabled={retrying || waiting}>
              {retryLabel}
            </Button>
          </Alert>
        )}
        {retryError && retryError !== status.message && (
          <Alert tone="error" message={retryError} />
        )}
        <div aria-live="polite" className="grid grid-cols-4 gap-3">
          {stageViews(status).map((view) => (
            <StageTile
              key={view.stage}
              kind={view.kind}
              label={view.label}
              detail={view.detail}
            />
          ))}
        </div>
      </section>

      {status.status !== "no_pass" && (
        <div className="grid max-w-[1100px] grid-cols-3 gap-6">
          {SKELETONS.map((n) => {
            const planned = status.candidates.find((c) => c.n === n);
            return (
              <CreativeSkeleton
                key={n}
                n={n}
                angle={planned ? angleLabel(planned.angle) : ""}
                animated={active}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
