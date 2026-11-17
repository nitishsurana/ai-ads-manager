"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { applyAnswers, type Answers, type ConfirmState } from "@/lib/confirm";
import { messages } from "@/lib/messages";
import { saveAnswersAction } from "@/app/(workspace)/w/[id]/actions";
import { failureMessage } from "./action-message";

// Answers apply on screen at once with the same pure function the server runs, and each one is saved as its own change; the server never needs the screen's whole state. A failed save keeps its message and reloads the screen from what the server has, so the two can't drift apart.
export function useAnswers(workspaceId: string, server: ConfirmState) {
  const router = useRouter();
  const [state, setState] = useState(server);
  const [seen, setSeen] = useState(server);
  const [resync, setResync] = useState(false);
  // Answers sent and not yet answered; they are laid over a fresh server snapshot so an edit made meanwhile isn't wiped.
  const [pending, setPending] = useState<Answers[]>([]);
  const [error, setError] = useState<string | null>(null);

  // `seen` follows every new server snapshot, so a resync adopts the latest one and never an older one.
  if (server !== seen) {
    setSeen(server);
    if (resync) {
      setState(pending.reduce(applyAnswers, server));
      setResync(false);
    }
  }

  const fail = (text: string) => {
    setError(text);
    setResync(true);
    router.refresh();
  };

  const settle = (answers: Answers) =>
    setPending((list) => list.filter((item) => item !== answers));

  const apply = (answers: Answers) => {
    setState((previous) => applyAnswers(previous, answers));
    setPending((list) => [...list, answers]);
    saveAnswersAction(workspaceId, answers).then(
      (result) => {
        settle(answers);
        if (result.ok) setError(null);
        else fail(failureMessage(result));
      },
      () => {
        settle(answers);
        fail(messages.save_failed);
      },
    );
  };

  return { state, apply, error };
}
