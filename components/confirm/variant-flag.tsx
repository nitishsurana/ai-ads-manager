"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Answers, ConfirmState } from "@/lib/confirm";

type VariantFlagProps = {
  state: ConfirmState;
  titles: Record<number, string>;
  needsConfirmation: boolean;
  apply: (answers: Answers) => void;
};

const NOTE = {
  buyable: "",
  unavailable: "can’t be bought online right now",
  unknown: "availability unknown",
} as const;

export function VariantFlag({
  state,
  titles,
  needsConfirmation,
  apply,
}: VariantFlagProps) {
  const chosen = state.variants.find((v) => v.id === state.variantId);
  const label = (id: number) => titles[id] ?? `Variant ${id}`;

  return (
    <Alert
      tone="warning"
      message="This product comes in several variants. Choose the one to advertise."
    >
      <div className="flex flex-col gap-2.5">
        <Select
          value={state.variantId === null ? "" : String(state.variantId)}
          onValueChange={(value) => apply({ variantId: Number(value) })}
        >
          <SelectTrigger aria-label="Variant" className="max-w-[420px] bg-card">
            <SelectValue placeholder="Choose a variant" />
          </SelectTrigger>
          <SelectContent>
            {state.variants.map((variant) => (
              <SelectItem key={variant.id} value={String(variant.id)}>
                {[label(variant.id), variant.price, NOTE[variant.availability]]
                  .filter(Boolean)
                  .join(" · ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {chosen && needsConfirmation && !state.variantConfirmed && (
          <div className="flex items-center gap-3">
            <p className="m-0 flex-1 text-[13px]">
              {chosen.availability === "unavailable"
                ? "This variant can’t be bought online right now. Use it anyway?"
                : "We couldn’t tell whether this variant can be bought. Use it anyway?"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => apply({ variantConfirmed: true })}
            >
              Use this variant
            </Button>
          </div>
        )}
        {chosen && needsConfirmation && state.variantConfirmed && (
          <div className="flex items-center gap-3">
            <p className="m-0 flex-1 text-[13px]">
              Using {label(chosen.id)} anyway.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => apply({ variantConfirmed: false })}
            >
              Undo
            </Button>
          </div>
        )}
      </div>
    </Alert>
  );
}
