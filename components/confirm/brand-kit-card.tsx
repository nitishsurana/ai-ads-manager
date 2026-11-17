"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FONT_FAMILIES } from "@/lib/fonts";
import type { Answers, ConfirmState } from "@/lib/confirm";
import { CommitInput, CommitTextarea } from "./commit-field";
import { LogoPreview } from "./logo-preview";
import { TextList } from "./text-list";

const ROLES = [
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["background", "Background"],
  ["text", "Text"],
] as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const TONE_SLOTS = 3;

type BrandKitCardProps = {
  state: ConfirmState;
  logoUrl: string | null;
  sample: string;
  apply: (answers: Answers) => void;
};

export function BrandKitCard({
  state,
  logoUrl,
  sample,
  apply,
}: BrandKitCardProps) {
  const { brandKit: kit, brandName, logo } = state;
  const [badHex, setBadHex] = useState<string | null>(null);
  const edit = (brandKit: NonNullable<Answers["brandKit"]>) =>
    apply({ brandKit });

  const commitHex = (role: (typeof ROLES)[number][0], text: string) => {
    const typed = text.trim();
    const hex = typed && !typed.startsWith("#") ? `#${typed}` : typed;
    if (hex !== "" && !HEX.test(hex)) return setBadHex(role);
    setBadHex(null);
    if ((hex || null) !== kit.palette[role]) {
      edit({ palette: { [role]: hex || null } });
    }
  };

  const commitTone = (index: number, text: string) => {
    const words = Array.from(
      { length: Math.max(TONE_SLOTS, kit.tone.length) },
      (_, i) => (i === index ? text : (kit.tone[i] ?? "")).trim(),
    ).filter(Boolean);
    if (words.join("\n") !== kit.tone.join("\n")) edit({ tone: words });
  };

  const families = FONT_FAMILIES.map((font) => font.family);
  const heading = kit.fonts.heading.family;
  const fontName = `"${heading}", serif`;

  return (
    <section
      id="brand"
      aria-labelledby="brand-h"
      className="flex w-full flex-col gap-4 rounded-xl border border-border bg-card p-5 font-sans text-sm text-foreground shadow-xs"
    >
      <div className="flex items-baseline gap-2.5">
        <h2 id="brand-h" className="m-0 text-base font-semibold tracking-tight">
          Brand kit
        </h2>
        <span className="text-xs text-muted-foreground">
          Found on the store. Edit anything that’s off.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-4.5">
          <LogoPreview
            logo={logo}
            url={logoUrl}
            typedName={brandName.value}
            kit={kit}
          />
          {brandName.needed && (
            <div>
              <label
                htmlFor="brand-name"
                className="mb-1.5 block text-[13px] font-medium"
              >
                Brand name
              </label>
              <div className="flex gap-1.5">
                <CommitInput
                  id="brand-name"
                  value={brandName.value}
                  maxLength={80}
                  placeholder="Store or brand name"
                  onCommit={(text) => {
                    if (
                      text.trim() !== brandName.value ||
                      !brandName.answered
                    ) {
                      apply({ brandName: text.trim() });
                    }
                  }}
                />
                <Button
                  variant="outline"
                  className="shrink-0"
                  onClick={() => apply({ brandName: "" })}
                >
                  No brand name
                </Button>
              </div>
              <p className="m-0 mt-1.5 text-xs text-muted-foreground">
                {logo
                  ? "Optional. The logo above is used either way."
                  : "Leave blank for no logo."}
              </p>
            </div>
          )}
          <div>
            <span className="mb-1.5 block text-[13px] font-medium">
              Colours
            </span>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(([role, name]) => (
                <div
                  key={role}
                  className="flex items-center gap-2.5 rounded-[10px] border border-border p-1.5"
                >
                  <span
                    className="size-9 shrink-0 rounded-lg border border-black/10 bg-[repeating-linear-gradient(135deg,var(--color-border)_0_4px,var(--color-card)_4px_8px)]"
                    style={
                      kit.palette[role]
                        ? { background: kit.palette[role] }
                        : undefined
                    }
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[13px] font-medium">{name}</span>
                    <CommitInput
                      aria-label={`${name} hex value`}
                      aria-invalid={badHex === role}
                      value={kit.palette[role] ?? ""}
                      placeholder="Not found"
                      className="h-auto w-24 border-0 bg-transparent p-0 font-mono text-xs text-muted-foreground placeholder:text-muted-foreground/70 placeholder:italic focus:text-foreground focus:ring-0 aria-invalid:text-destructive"
                      onCommit={(text) => commitHex(role, text)}
                    />
                  </span>
                </div>
              ))}
            </div>
            {badHex && (
              <p role="alert" className="m-0 mt-1.5 text-xs text-destructive">
                Use a hex colour such as #2f4fd8.
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="typeface"
              className="mb-1.5 block text-[13px] font-medium"
            >
              Typeface
            </label>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl font-semibold"
                style={{ fontFamily: fontName }}
              >
                Aa
              </span>
              <Select
                value={heading}
                onValueChange={(typeface) => edit({ typeface })}
              >
                <SelectTrigger id="typeface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(families.includes(heading)
                    ? families
                    : [heading, ...families]
                  ).map((family) => (
                    <SelectItem key={family} value={family}>
                      {family}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p
              className="m-0 mt-2 text-xl font-semibold"
              style={{ fontFamily: fontName }}
            >
              {sample}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4.5">
          <div>
            <span className="mb-1.5 block text-[13px] font-medium">
              Tone words
            </span>
            <div className="grid grid-cols-3 gap-2">
              {Array.from(
                { length: Math.max(TONE_SLOTS, kit.tone.length) },
                (_, index) => (
                  <CommitInput
                    key={index}
                    aria-label={`Tone word ${index + 1}`}
                    value={kit.tone[index] ?? ""}
                    maxLength={30}
                    onCommit={(text) => commitTone(index, text)}
                  />
                ),
              )}
            </div>
          </div>
          <div>
            <label
              htmlFor="audience"
              className="mb-1.5 block text-[13px] font-medium"
            >
              Target audience
            </label>
            <CommitTextarea
              id="audience"
              rows={2}
              maxLength={300}
              value={kit.audience}
              onCommit={(text) => {
                if (text.trim() !== kit.audience) {
                  edit({ audience: text.trim() });
                }
              }}
            />
          </div>
          <TextList
            title="Value propositions"
            items={kit.valuePropositions}
            max={5}
            maxLength={120}
            itemLabel="Value proposition"
            addLabel="Add value proposition"
            onChange={(valuePropositions) => edit({ valuePropositions })}
          />
          <TextList
            title="Proof points"
            items={kit.proofPoints}
            max={8}
            maxLength={120}
            itemLabel="Proof point"
            addLabel="Add proof point"
            onChange={(proofPoints) => edit({ proofPoints })}
          />
        </div>
      </div>
    </section>
  );
}
