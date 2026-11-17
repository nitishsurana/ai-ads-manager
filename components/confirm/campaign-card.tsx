"use client";

import type { Campaign } from "@/lib/chat/campaign";
import type { Fact } from "@/lib/db/queries";
import { CommitInput } from "./commit-field";
import { FactRow } from "./fact-row";

const FIELDS = [
  ["occasion", "Occasion", "occ"],
  ["angle", "Angle", "ang"],
  ["audience", "Audience", "aud"],
] as const;

type CampaignCardProps = {
  campaign: Campaign;
  facts: Fact[];
  onCampaign: (field: keyof Campaign, text: string) => void;
  onConfirmFact: (id: string) => void;
  onEditFact: (id: string, text: string) => void;
  onRemoveFact: (id: string) => void;
};

export function CampaignCard({
  campaign,
  facts,
  onCampaign,
  onConfirmFact,
  onEditFact,
  onRemoveFact,
}: CampaignCardProps) {
  const current = {
    occasion: campaign.occasion ?? "",
    angle: campaign.angle ?? "",
    audience: campaign.audience ?? "",
  };

  return (
    <section
      id="facts"
      aria-labelledby="camp-h"
      className="flex w-full flex-col gap-4 rounded-xl border border-border bg-card p-5 font-sans text-sm text-foreground shadow-xs"
    >
      <div className="flex items-baseline gap-2.5">
        <h2 id="camp-h" className="m-0 text-base font-semibold tracking-tight">
          Campaign context and facts from chat
        </h2>
        <span className="text-xs text-muted-foreground">
          What I understood from your message. Edit anything that’s off.
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {FIELDS.map(([key, label, id]) => (
          <div key={key}>
            <label
              htmlFor={id}
              className="mb-1.5 block text-[13px] font-medium"
            >
              {label}
            </label>
            <CommitInput
              id={id}
              value={current[key]}
              maxLength={80}
              onCommit={(text) => {
                if (text.trim() !== current[key]) {
                  onCampaign(key, text.trim());
                }
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-3.5">
        <div className="flex items-baseline gap-2.5">
          <h3 className="m-0 text-sm font-semibold">Facts you told me</h3>
          <span className="text-xs text-muted-foreground">
            Not on the product page. Only confirmed facts can appear in ads.
          </span>
        </div>
        {facts.map((fact) => (
          <FactRow
            key={fact.id}
            fact={fact}
            onConfirm={() => onConfirmFact(fact.id)}
            onSave={(text) => onEditFact(fact.id, text)}
            onRemove={() => onRemoveFact(fact.id)}
          />
        ))}
        {facts.length === 0 && (
          <p className="m-0 text-[13px] text-muted-foreground">
            No extra facts. Tell me in the chat if there’s an offer or detail to
            use.
          </p>
        )}
      </div>
    </section>
  );
}
