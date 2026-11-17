"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { confirmedPrices, canGenerate } from "@/lib/confirm";
import type { Fact } from "@/lib/db/queries";
import type { ConfirmScreenData } from "@/lib/workspace";
import {
  confirmFactAction,
  editFactAction,
  generateCreativesAction,
  removeFactAction,
  saveCampaignAction,
  saveChangesAction,
  type ActionResult,
} from "@/app/(workspace)/w/[id]/actions";
import { messages } from "@/lib/messages";
import { plural } from "@/lib/utils";
import { failureMessage } from "./action-message";
import { BrandKitCard } from "./brand-kit-card";
import { CampaignCard } from "./campaign-card";
import { FlagsSection } from "./flags-section";
import { GenerateBar } from "./generate-bar";
import { generateNote } from "./generate-note";
import { PhotosSection } from "./photos-section";
import { PriceCard } from "./price-card";
import { RatingCard } from "./rating-card";
import { useAnswers } from "./use-answers";

type FactChange =
  | { type: "confirm"; id: string }
  | { type: "edit"; id: string; text: string }
  | { type: "remove"; id: string };

function applyFactChange(facts: Fact[], change: FactChange) {
  switch (change.type) {
    case "confirm":
      return facts.map((fact) =>
        fact.id === change.id
          ? { ...fact, status: "confirmed" as const }
          : fact,
      );
    case "edit":
      return facts.map((fact) =>
        fact.id === change.id
          ? { ...fact, text: change.text, status: "pending" as const }
          : fact,
      );
    case "remove":
      return facts.filter((fact) => fact.id !== change.id);
  }
}

type ConfirmFormProps = {
  screen: ConfirmScreenData;
  // "edit" is the screen reopened after round 1: the bar saves instead of generating.
  mode: "first" | "edit";
  header: ReactNode;
};

export function ConfirmForm({ screen, mode, header }: ConfirmFormProps) {
  const router = useRouter();
  const {
    state,
    apply,
    error: saveError,
  } = useAnswers(screen.id, screen.state);
  const [switching, setSwitching] = useState<string | null>(null);
  const [otherError, setOtherError] = useState<string | null>(null);
  // Signed URLs change on every refresh; the first one per image is kept so the images don't reload.
  const [photoViews] = useState(screen.photoViews);
  const [logoUrl] = useState(screen.logoUrl);
  const [facts, changeFact] = useOptimistic(screen.facts, applyFactChange);
  const [, startWrite] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const failed = (text: string) => {
    setOtherError(text);
    router.refresh();
  };
  const report = (result: ActionResult) => {
    if (result.ok) setOtherError(null);
    else failed(failureMessage(result));
  };

  const write = (action: () => Promise<ActionResult>, change?: FactChange) =>
    startWrite(async () => {
      if (change) changeFact(change);
      try {
        report(await action());
      } catch {
        failed(messages.save_failed);
      }
    });

  const edit = mode === "edit";
  const submit = () =>
    startSubmit(async () => {
      try {
        const result = await (
          edit ? saveChangesAction : generateCreativesAction
        )(screen.id);
        report(result);
        if (!result.ok) return;
        if (edit) router.push(`/w/${screen.id}`);
        else router.refresh();
      } catch {
        failed(messages.save_failed);
      }
    });

  const selected = state.photos.filter((photo) => photo.selected).length;
  const confirmedFacts = facts.filter((fact) => fact.status === "confirmed");
  const pendingFacts = facts.length - confirmedFacts.length;
  // The spend cap blocks starting a round, not saving changes.
  const spendCapped = !edit && screen.spendCapped;
  const note = generateNote(state, {
    switching,
    pendingFacts,
    edit,
    spendCapped,
  });
  const summary = [
    `${selected} ${plural(selected, "photo", "photos")}`,
    `price ${confirmedPrices(state).price ? "on" : "off"}`,
    `rating ${state.showRating && state.rating ? "on" : "off"}`,
    `${confirmedFacts.length} ${plural(confirmedFacts.length, "fact", "facts")} confirmed`,
  ].join(" · ");
  const error = saveError ?? otherError;

  return (
    <>
      <div className="flex w-full max-w-[1024px] flex-col gap-5 px-8 pb-6">
        {header}
        {error && <Alert tone="error" message={error} />}
        <fieldset
          disabled={screen.locked}
          className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0"
        >
          {screen.locked && (
            <Alert
              tone="info"
              message="A round is running. You can change these once it finishes."
            />
          )}
          <FlagsSection
            state={state}
            variantTitles={screen.variantTitles}
            apply={apply}
          />
          <PhotosSection state={state} views={photoViews} apply={apply} />
          <BrandKitCard
            state={state}
            logoUrl={logoUrl}
            sample={screen.title}
            apply={apply}
          />
          <div className="grid grid-cols-2 gap-5">
            <PriceCard
              state={state}
              switching={switching}
              onSwitching={setSwitching}
              apply={apply}
            />
            <RatingCard
              rating={state.rating}
              show={state.showRating}
              onShow={(showRating) => apply({ showRating })}
            />
          </div>
          <CampaignCard
            campaign={screen.campaign}
            facts={facts}
            onCampaign={(field, text) =>
              write(() => saveCampaignAction(screen.id, { [field]: text }))
            }
            onConfirmFact={(id) =>
              write(() => confirmFactAction(screen.id, id), {
                type: "confirm",
                id,
              })
            }
            onEditFact={(id, text) =>
              write(() => editFactAction(screen.id, id, text), {
                type: "edit",
                id,
                text,
              })
            }
            onRemoveFact={(id) =>
              write(() => removeFactAction(screen.id, id), {
                type: "remove",
                id,
              })
            }
          />
        </fieldset>
      </div>
      <div className="sticky bottom-0 mt-auto">
        <GenerateBar
          summary={summary}
          note={note.text}
          tone={note.tone}
          disabled={
            !canGenerate(state) ||
            switching !== null ||
            screen.locked ||
            spendCapped
          }
          pending={submitting}
          label={edit ? "Save changes" : "Generate creatives"}
          pendingLabel={edit ? "Saving…" : "Generating…"}
          onSubmit={submit}
        />
      </div>
    </>
  );
}
