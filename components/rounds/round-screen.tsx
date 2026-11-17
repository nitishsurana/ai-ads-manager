"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { generateCreativesAction } from "@/app/(workspace)/w/[id]/actions";
import { failureMessage } from "@/components/confirm/action-message";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { roundStatusSchema, type RoundStatusView } from "@/lib/round/schema";
import { messages } from "@/lib/messages";

const POLL_MS = 2_000;

const STAGE_LABELS = {
  writing_copy: "Writing copy",
  making_backgrounds: "Making backgrounds",
  compositing: "Compositing",
  checking_quality: "Checking quality",
} as const;

type RoundScreenProps = { workspaceId: string; initial: RoundStatusView };

// Placeholder until the Generating and Round views (Phase 7): polls the round and shows its outcome.
export function RoundScreen({ workspaceId, initial }: RoundScreenProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrying, startRetry] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  const active = status.status === "queued" || status.status === "running";

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let inFlight = false;
    const timer = setInterval(async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/rounds/${status.id}`, {
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 404) {
          clearInterval(timer);
          router.refresh();
          return;
        }
        if (!response.ok) return;
        const parsed = roundStatusSchema.safeParse(await response.json());
        if (!parsed.success) {
          console.error("round status: unexpected response", parsed.error);
          return;
        }
        setStatus(parsed.data);
      } catch {
        // Network and abort errors: the next tick tries again.
      } finally {
        inFlight = false;
      }
    }, POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [active, status.id, router]);

  // A timed-out round allows its retry only from retryAt; the button waits for it.
  useEffect(() => {
    if (!status.retryAt) return;
    const wait = Math.max(0, Date.parse(status.retryAt) - Date.now());
    const timer = setTimeout(() => setNow(Date.now()), wait + 50);
    return () => clearTimeout(timer);
  }, [status.retryAt]);
  const waiting =
    status.retryAt !== null &&
    (now === null || now < Date.parse(status.retryAt));

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

  const current = status.stage ? status.counts[status.stage] : undefined;

  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <h2 className="m-0 text-lg font-semibold">
        Round {status.n}
        {status.attempt > 1 ? `, attempt ${status.attempt}` : ""}
      </h2>
      {active && (
        <>
          <p className="m-0 text-muted-foreground">
            {status.stage
              ? `${STAGE_LABELS[status.stage]}${current ? ` · ${current.done} of ${current.total} done` : ""}`
              : status.status === "queued"
                ? "Waiting to start"
                : "Starting"}
          </p>
          <div className="flex gap-3">
            {[0, 1, 2].map((slot) => (
              <div
                key={slot}
                className="flex h-40 w-24 items-end rounded-md bg-muted p-2 text-xs text-muted-foreground"
              >
                {status.candidates[slot]?.angle.replaceAll("_", " ")}
              </div>
            ))}
          </div>
        </>
      )}
      {status.status === "done" && (
        <>
          <p className="m-0">
            {status.creatives.length}{" "}
            {status.creatives.length === 1 ? "creative" : "creatives"} ready
          </p>
          <div className="flex gap-3">
            {status.creatives.map((creative) => (
              <figure key={creative.n} className="m-0">
                {creative.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creative.previewUrl}
                    alt={`Creative ${creative.n}`}
                    className="h-40 rounded-md"
                  />
                )}
                <figcaption className="text-xs text-muted-foreground">
                  {creative.angle.replaceAll("_", " ")}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
      {status.message && (
        <>
          <Alert tone="error" message={status.message} />
          <div>
            <Button onClick={retry} disabled={retrying || waiting}>
              {retrying ? "Starting…" : "Try again"}
            </Button>
          </div>
        </>
      )}
      {retryError && retryError !== status.message && (
        <Alert tone="error" message={retryError} />
      )}
    </section>
  );
}
