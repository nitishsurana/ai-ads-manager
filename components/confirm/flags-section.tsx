"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  confirmMessages,
  variantNeedsConfirmation,
  type Answers,
  type ConfirmState,
} from "@/lib/confirm";
import { plural } from "@/lib/utils";
import { VariantFlag } from "./variant-flag";

type FlagsSectionProps = {
  state: ConfirmState;
  variantTitles: Record<number, string>;
  apply: (answers: Answers) => void;
};

const linkClass =
  "shrink-0 text-[13px] font-medium text-inherit underline-offset-2 hover:underline";

export function FlagsSection({
  state,
  variantTitles,
  apply,
}: FlagsSectionProps) {
  const found = confirmMessages(state);
  const noLogo = found.find((message) => message.code === "no_logo");
  const addedText = found.filter((message) => message.code === "photo_text");
  const lowRes = found.filter((message) => message.code === "low_resolution");
  const transparent = found.filter((message) => message.code === "transparent");
  const [firstTransparent] = transparent;
  const purchase = found.find((message) => message.code === "not_purchasable");
  const personalize = found.find((message) => message.code === "personalize");
  const skipped = found.find((message) => message.code === "photos_skipped");
  const needsVariant = state.needsVariantChoice;

  const count =
    [purchase, personalize, skipped, needsVariant, noLogo].filter(Boolean)
      .length +
    [addedText, lowRes, transparent].filter((photos) => photos.length > 0)
      .length;
  if (count === 0) return null;

  return (
    <section
      aria-labelledby="flags-h"
      className="flex flex-col gap-2.5 rounded-xl border border-border bg-card px-5 py-4 shadow-xs"
    >
      <h2 id="flags-h" className="m-0 text-[15px] font-semibold tracking-tight">
        {count} {plural(count, "thing", "things")} to check
      </h2>
      {purchase &&
        (state.markedAvailable ? (
          <Alert
            tone="success"
            message="Marked as available: shoppers can buy this online."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => apply({ markedAvailable: false })}
              >
                Undo
              </Button>
            }
          />
        ) : state.continuePastFlag === true ? (
          <Alert
            tone="success"
            message="Continuing anyway: this product can’t be bought online right now."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => apply({ continuePastFlag: false })}
              >
                Undo
              </Button>
            }
          />
        ) : (
          <Alert
            tone="warning"
            message={purchase.text}
            action={
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => apply({ markedAvailable: true })}
                >
                  It’s available
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => apply({ continuePastFlag: true })}
                >
                  Continue anyway
                </Button>
              </div>
            }
          />
        ))}
      {personalize && <Alert tone="info" message={personalize.text} />}
      {skipped && <Alert tone="warning" message={skipped.text} />}
      {needsVariant && (
        <VariantFlag
          state={state}
          titles={variantTitles}
          needsConfirmation={variantNeedsConfirmation(state)}
          apply={apply}
        />
      )}
      {noLogo && (
        <Alert
          tone="warning"
          message={noLogo.text}
          action={
            <a href="#brand" className={linkClass}>
              Add a brand name
            </a>
          }
        />
      )}
      {addedText.length > 0 && (
        <Alert
          tone="warning"
          message={`${addedText.length} ${plural(addedText.length, "photo has", "photos have")} added text. Photos without text are used first.`}
          action={
            <Link href="#photos" className={linkClass}>
              Review {addedText.length === 1 ? "photo" : "photos"}
            </Link>
          }
        />
      )}
      {firstTransparent && (
        <Alert
          tone="info"
          message={firstTransparent.text}
          action={
            <Link href="#photos" className={linkClass}>
              Review {transparent.length === 1 ? "photo" : "photos"}
            </Link>
          }
        />
      )}
      {lowRes.length > 0 && (
        <Alert
          tone="warning"
          message={`${lowRes.length} ${plural(lowRes.length, "photo is", "photos are")} low resolution and may look soft.`}
          action={
            <Link href="#photos" className={linkClass}>
              Review {lowRes.length === 1 ? "photo" : "photos"}
            </Link>
          }
        />
      )}
    </section>
  );
}
