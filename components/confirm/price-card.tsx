"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  confirmedPrices,
  type Answers,
  type ConfirmState,
} from "@/lib/confirm";
import { typedAmount } from "@/lib/money";
import { CommitInput } from "./commit-field";

type PriceCardProps = {
  state: ConfirmState;
  // The currency the tester picked and hasn't entered a price for yet.
  switching: string | null;
  onSwitching: (code: string | null) => void;
  apply: (answers: Answers) => void;
};

const INVALID = "Enter an amount above zero.";

// The number the field shows; the symbol is in the "In ads" line.
const amountOf = (text: string | null) =>
  text ? text.replace(/[^\d.,]/g, "") : "";

export function PriceCard({
  state,
  switching,
  onSwitching,
  apply,
}: PriceCardProps) {
  const [error, setError] = useState<"price" | "was" | null>(null);
  const [addingWas, setAddingWas] = useState(false);
  const shown = confirmedPrices(state);
  const off = !state.showPrice;
  const hasWas = state.showWasPrice && state.wasPrice !== null;

  const commitPrice = (text: string) => {
    const typed = text.trim();
    if (switching) {
      if (!typed) return;
      if (typedAmount(typed) === null) return setError("price");
      setError(null);
      apply({ currency: { code: switching, price: typed } });
      return onSwitching(null);
    }
    if (typed === amountOf(state.price)) return setError(null);
    if (!typed) {
      setError(null);
      return apply({ clearPrice: true });
    }
    if (typedAmount(typed) === null) return setError("price");
    setError(null);
    apply({ price: { show: true, value: typed } });
  };

  const commitWas = (text: string) => {
    const typed = text.trim();
    if (!typed) return setAddingWas(false);
    if (typedAmount(typed) === null) return setError("was");
    setError(null);
    setAddingWas(false);
    if (typed !== amountOf(state.wasPrice) || !state.showWasPrice) {
      apply({ wasPrice: { show: true, value: typed } });
    }
  };

  return (
    <section
      aria-labelledby="price-h"
      className="flex w-full flex-col gap-3.5 rounded-xl border border-border bg-card p-5 font-sans text-sm text-foreground shadow-xs"
    >
      <div className="flex items-center gap-2.5">
        <h2 id="price-h" className="m-0 text-base font-semibold tracking-tight">
          Price
        </h2>
        <Switch
          className="ml-auto"
          label="Show price"
          checked={state.showPrice}
          onCheckedChange={(show) => apply({ price: { show } })}
        />
      </div>
      <div className="grid grid-cols-[1fr_1fr_96px] items-end gap-2.5">
        <div>
          <label
            htmlFor="price"
            className="mb-1.5 block text-[13px] font-medium"
          >
            Price
          </label>
          <CommitInput
            id="price"
            value={switching ? "" : amountOf(state.price)}
            placeholder={switching ? `Price in ${switching}` : undefined}
            disabled={off}
            aria-invalid={error === "price"}
            aria-describedby="price-note"
            inputMode="decimal"
            onCommit={commitPrice}
          />
        </div>
        {hasWas || addingWas ? (
          <div>
            <label
              htmlFor="was"
              className="mb-1.5 block text-[13px] font-medium"
            >
              Was price
            </label>
            <div className="flex gap-1">
              <CommitInput
                id="was"
                value={amountOf(state.wasPrice)}
                disabled={off}
                autoFocus={addingWas}
                aria-invalid={error === "was"}
                aria-describedby="price-note"
                inputMode="decimal"
                onCommit={commitWas}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                disabled={off}
                aria-label="Remove was price"
                onClick={() => {
                  setAddingWas(false);
                  if (hasWas) apply({ wasPrice: { show: false } });
                }}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            disabled={off}
            className="gap-1.5 px-3"
            onClick={() =>
              state.wasPrice !== null
                ? apply({ wasPrice: { show: true } })
                : setAddingWas(true)
            }
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add was price
          </Button>
        )}
        <div>
          <label
            htmlFor="currency"
            className="mb-1.5 block text-[13px] font-medium"
          >
            Currency
          </label>
          <Select
            value={switching ?? state.currency}
            disabled={off}
            onValueChange={(code) => {
              setError(null);
              onSwitching(code === state.currency ? null : code);
              if (code !== state.currency) {
                requestAnimationFrame(() =>
                  document.getElementById("price")?.focus(),
                );
              }
            }}
          >
            <SelectTrigger id="currency" className="px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {state.currencies.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p
        id="price-note"
        role={error ? "alert" : undefined}
        className={
          error || switching
            ? "m-0 -mt-1.5 text-xs text-warning-foreground"
            : "sr-only"
        }
      >
        {error
          ? INVALID
          : switching
            ? `Enter the price in ${switching} to finish switching.`
            : ""}
      </p>
      <div className="flex items-center gap-2.5 rounded-[10px] bg-muted px-3 py-2.5 text-[13px]">
        <span className="text-muted-foreground">In ads</span>
        {shown.price ? (
          <>
            <span className="text-[15px] font-semibold">{shown.price}</span>
            {shown.wasPrice && (
              <span className="text-muted-foreground line-through">
                {shown.wasPrice}
              </span>
            )}
          </>
        ) : (
          <span>Price won’t appear in ads.</span>
        )}
      </div>
    </section>
  );
}
