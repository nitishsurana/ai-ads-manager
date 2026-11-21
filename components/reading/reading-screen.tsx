"use client";

import { Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  readingStatusSchema,
  type ReadingStatus,
} from "@/lib/intake/reading/schema";
import { stepsFor } from "@/lib/intake/reading/steps";
import { messages } from "@/lib/messages";
import { StatusStep } from "./status-step";

const POLL_MS = 2_000;
const PHOTO_SLOTS = 6;

const retryResponseSchema = z.object({
  intakeId: z.string().optional(),
  error: z.string().optional(),
});

type ReadingScreenProps = { intakeId: string; initial: ReadingStatus };

// Signed thumbnail URLs change on every poll; keeping the first one per photo stops the images reloading.
function keepPhotoUrls(previous: ReadingStatus, next: ReadingStatus) {
  const known = new Map(previous.photos.map((p) => [p.position, p.url]));
  return {
    ...next,
    photos: next.photos.map((p) => ({
      position: p.position,
      url: known.get(p.position) ?? p.url,
    })),
  };
}

export function ReadingScreen({ intakeId, initial }: ReadingScreenProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const response = await fetch(`/api/intakes/${intakeId}/retry`, {
        method: "POST",
      });
      const body = retryResponseSchema.safeParse(await response.json());
      if (response.ok && body.data?.intakeId) {
        router.replace(`/r/${body.data.intakeId}`);
        return;
      }
      setRetryError(body.data?.error ?? messages.retry_failed);
    } catch {
      setRetryError(messages.retry_failed);
    }
    setRetrying(false);
  }

  useEffect(() => {
    if (status.status !== "reading") return;
    const controller = new AbortController();
    let inFlight = false;
    const timer = setInterval(async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/intakes/${intakeId}`, {
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 404) {
          clearInterval(timer);
          router.refresh();
          return;
        }
        if (!response.ok) return;
        const parsed = readingStatusSchema.safeParse(await response.json());
        if (!parsed.success) {
          console.error("intake status: unexpected response", parsed.error);
          return;
        }
        setStatus((previous) => keepPhotoUrls(previous, parsed.data));
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
  }, [intakeId, status.status, router]);

  useEffect(() => {
    if (status.status === "done" && status.workspaceId) {
      router.replace(`/w/${status.workspaceId}`);
    } else if (status.status === "failed" && initial.status === "reading") {
      // The chat pane switches to its failed mode and shows the failure message.
      router.refresh();
    }
  }, [status.status, status.workspaceId, initial.status, router]);

  const failed = status.status === "failed";
  const steps = stepsFor(status);

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs break-all text-muted-foreground">
          <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
          {status.url}
        </span>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">
          {failed ? "We couldn’t read this product" : "Reading the product"}
        </h1>
      </div>

      <section
        aria-live="polite"
        className="rounded-xl border border-border bg-card px-5 py-2 shadow-xs"
      >
        {steps.map((step, index) => (
          <StatusStep
            key={step.label}
            {...step}
            last={index === steps.length - 1}
          />
        ))}
      </section>

      {status.status === "reading" && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Photos so far</span>
          <div className="grid grid-cols-6 gap-2">
            {status.photos.map((photo) => (
              <div
                key={photo.position}
                className="aspect-square overflow-hidden rounded-lg bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={`Product photo ${photo.position}`}
                  className="size-full object-cover"
                />
              </div>
            ))}
            {Array.from(
              { length: Math.max(PHOTO_SLOTS - status.photos.length, 0) },
              (_, index) => (
                <div
                  key={`slot-${index}`}
                  className="aspect-square animate-shimmer rounded-lg bg-[linear-gradient(90deg,var(--color-muted)_0%,var(--color-border)_50%,var(--color-muted)_100%)] bg-[length:200%_100%]"
                />
              ),
            )}
          </div>
        </div>
      )}

      {failed && (
        <Alert
          tone="error"
          message={status.failure?.message ?? messages.intake_failed}
          detail={retryError ?? "Nothing was saved from this attempt."}
        >
          <div className="flex gap-2">
            {status.canRetry && (
              <Button onClick={retry} disabled={retrying}>
                Try again
              </Button>
            )}
            <Button
              variant="outline"
              className="text-foreground"
              onClick={() => document.getElementById("chat-composer")?.focus()}
            >
              Try another link
            </Button>
          </div>
        </Alert>
      )}
    </div>
  );
}
