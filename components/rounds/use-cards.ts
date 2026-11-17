"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rateCreativeAction } from "@/app/(workspace)/w/[id]/round-actions";
import { messages } from "@/lib/messages";
import { hasReason, TAGS, type Tag } from "@/lib/round/feedback/tags";
import { failureText } from "@/lib/round/result";
import type { CreativeView } from "@/lib/round";

export type Choice = "approve" | "reject" | null;

export type CardState = {
  choice: Choice;
  tags: Tag[];
  note: string;
  editing: boolean;
  error: string | null;
  // A change is waiting to be saved or on its way.
  saving: boolean;
};

const NOTE_DELAY_MS = 600;

const isTag = (tag: string): tag is Tag => TAGS.some((known) => known === tag);

const initial = (creative: CreativeView): CardState => ({
  choice: creative.rating,
  tags: creative.tags.filter(isTag),
  note: creative.note,
  editing: false,
  error: null,
  saving: false,
});

export const isRated = (card: CardState) =>
  card.choice === "approve" ||
  (card.choice === "reject" && hasReason(card.tags, card.note));

// What is saved for a card. A reject without a reason is not a rating yet, so it clears the stored one.
function payload(card: CardState) {
  if (card.choice === "approve") {
    return { rating: "approve" as const, tags: [], note: card.note };
  }
  return card.choice === "reject" && hasReason(card.tags, card.note)
    ? { rating: "reject" as const, tags: card.tags, note: card.note }
    : { rating: null, tags: [], note: "" };
}

// Rating, reason and edit state per card; saves go one at a time per card, naming the last rev, and notes wait for a pause in typing.
export function useCards(workspaceId: string, creatives: CreativeView[]) {
  const [cards, setCards] = useState<Record<string, CardState>>(() =>
    Object.fromEntries(creatives.map((c) => [c.id, initial(c)])),
  );
  const latest = useRef(cards);
  const revs = useRef<Record<string, number>>(
    Object.fromEntries(creatives.map((c) => [c.id, c.rev])),
  );
  const saved = useRef<Record<string, string>>(
    Object.fromEntries(
      creatives.map((c) => [c.id, JSON.stringify(payload(initial(c)))]),
    ),
  );
  const chains = useRef<Record<string, Promise<void>>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const seqs = useRef<Record<string, number>>({});

  useEffect(() => {
    latest.current = cards;
  }, [cards]);
  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  const patch = useCallback((id: string, change: Partial<CardState>) => {
    setCards((all) => {
      const card = all[id];
      return card ? { ...all, [id]: { ...card, ...change } } : all;
    });
  }, []);

  const send = useCallback(
    (id: string) => {
      const seq = seqs.current[id] ?? 0;
      chains.current[id] = (chains.current[id] ?? Promise.resolve()).then(
        async () => {
          const card = latest.current[id];
          const body = card ? payload(card) : null;
          const key = JSON.stringify(body);
          try {
            if (body && saved.current[id] !== key) {
              const result = await rateCreativeAction({
                workspaceId,
                creativeId: id,
                rev: revs.current[id] ?? 0,
                ...body,
              });
              if (result.ok) {
                revs.current[id] = result.rev;
                saved.current[id] = key;
                patch(id, { error: null });
              } else {
                patch(id, { error: failureText(result) });
              }
            }
          } catch (error) {
            console.error(`rating ${id} failed`, error);
            patch(id, { error: messages.save_failed });
          }
          if (seqs.current[id] === seq) patch(id, { saving: false });
        },
      );
    },
    [patch, workspaceId],
  );

  const save = useCallback(
    (id: string, delay = 0) => {
      seqs.current[id] = (seqs.current[id] ?? 0) + 1;
      clearTimeout(timers.current[id]);
      patch(id, { saving: true });
      timers.current[id] = setTimeout(() => send(id), delay);
    },
    [patch, send],
  );

  const choose = (id: string, choice: "approve" | "reject") => {
    patch(id, { choice });
    save(id);
  };

  return {
    cards,
    revOf: (id: string) => revs.current[id] ?? 0,
    approve: (id: string) => choose(id, "approve"),
    reject: (id: string) => choose(id, "reject"),
    toggleTag: (id: string, tag: Tag) => {
      const card = latest.current[id];
      if (!card) return;
      const tags = card.tags.includes(tag)
        ? card.tags.filter((t) => t !== tag)
        : [...card.tags, tag];
      patch(id, { tags });
      save(id);
    },
    setNote: (id: string, note: string) => {
      patch(id, { note });
      save(id, NOTE_DELAY_MS);
    },
    flush: (id: string) => {
      if (latest.current[id]?.saving) save(id);
    },
    startEdit: (id: string) => patch(id, { editing: true }),
    stopEdit: (id: string) => patch(id, { editing: false }),
    edited: (id: string, rev: number) => {
      revs.current[id] = rev;
      patch(id, { editing: false });
    },
  };
}
