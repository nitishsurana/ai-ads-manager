"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { roundStatusSchema, type RoundStatusView } from "@/lib/round/schema";

const POLL_MS = 2_000;

// The round's status, polled every 2 s while it is queued or running (the one fetch in an effect the plan allows). A round that ended (done, failed, timed out or no pass), or one the caller no longer owns, refreshes the page, so the server picks the screen and the chat header follows.
export function useRoundPoll(initial: RoundStatusView) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
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
        if (
          parsed.data.status !== "queued" &&
          parsed.data.status !== "running"
        ) {
          clearInterval(timer);
          router.refresh();
        }
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

  return status;
}

// Wall-clock time that re-renders every second while `running`.
export function useNow(running: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}
