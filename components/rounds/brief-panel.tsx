"use client";

import { ChevronDown, FileText, Lock, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { BriefContext } from "./brief-context";
import { saveBriefAction } from "@/app/(workspace)/w/[id]/round-actions";
import { notAppliedText, settingsText } from "@/lib/brief/settings-line";
import { messages } from "@/lib/messages";
import type { BriefPanelData } from "@/lib/brief/panel";
import type { BriefRule } from "@/lib/brief/schema";
import { campaignText } from "@/lib/round/campaign-line";
import { failureText } from "@/lib/round/result";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<BriefRule["source"], string> = {
  chat: "Chat",
  round: "Round",
  tester_edit: "Your edit",
};

const CAUSE_LABEL = { initial: "Initial", ...SOURCE_LABEL };

const FIELD =
  "block h-8 w-full rounded-md border border-input bg-card px-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-primary-subtle disabled:opacity-50";

type RuleList = Pick<BriefRule, "id" | "kind" | "text">[];

type BriefPanelProps = {
  workspaceId: string;
  data: BriefPanelData;
};

export function BriefPanel({ workspaceId, data }: BriefPanelProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(
    null,
  );
  // Enter blurs the field (which saves once); Escape skips that save.
  const cancelled = useRef(false);
  const [drafts, setDrafts] = useState({ do: "", dont: "" });
  const { rules, campaign } = data.content;

  const save = (next: RuleList, after?: () => void) =>
    startSave(async () => {
      try {
        const result = await saveBriefAction(workspaceId, {
          baseVersion: data.version,
          rules: next,
        });
        if (result.ok) {
          setError(null);
          after?.();
        } else {
          setError(failureText(result));
        }
      } catch (failure) {
        console.error(`brief ${workspaceId}: saving failed`, failure);
        setError(messages.save_failed);
      }
    });

  const simple = (list: BriefRule[]): RuleList =>
    list.map(({ id, kind, text }) => ({ id, kind, text }));
  const remove = (id: string) =>
    save(simple(rules.filter((rule) => rule.id !== id)));
  const rename = (id: string, text: string) => {
    const trimmed = text.trim();
    setEditing(null);
    const current = rules.find((rule) => rule.id === id);
    if (!trimmed || !current || trimmed === current.text) return;
    save(
      simple(rules).map((rule) =>
        rule.id === id ? { ...rule, text: trimmed } : rule,
      ),
    );
  };
  const add = (kind: "do" | "dont") => {
    const text = drafts[kind].trim();
    if (!text) return;
    save([...simple(rules), { id: "", kind, text }], () =>
      setDrafts((all) => ({ ...all, [kind]: "" })),
    );
  };

  const column = (kind: "do" | "dont") => (
    <div className="flex flex-col gap-2">
      <h3
        className={cn(
          "m-0 text-[13px] font-semibold",
          kind === "do" ? "text-success" : "text-destructive",
        )}
      >
        {kind === "do" ? "Do" : "Don’t"}
      </h3>
      {rules
        .filter((rule) => rule.kind === kind)
        .map((rule) => (
          <div
            key={rule.id}
            className="flex items-start gap-2 rounded-lg bg-muted px-2.5 py-2 text-[13px]"
          >
            <span className="flex-1">
              {editing?.id === rule.id ? (
                <input
                  autoFocus
                  aria-label="Edit rule"
                  value={editing.text}
                  maxLength={200}
                  onChange={(event) =>
                    setEditing({ id: rule.id, text: event.target.value })
                  }
                  onBlur={() => {
                    if (cancelled.current) cancelled.current = false;
                    else rename(rule.id, editing.text);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") {
                      cancelled.current = true;
                      setEditing(null);
                    }
                  }}
                  className={FIELD}
                />
              ) : (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setEditing({ id: rule.id, text: rule.text })}
                    className="cursor-text border-0 bg-transparent p-0 text-left text-inherit"
                  >
                    {rule.text}
                  </button>{" "}
                  <span className="ml-1 inline-flex h-5 items-center gap-1 rounded-full bg-primary-subtle px-1.5 text-[11px] font-medium text-primary-text">
                    {rule.locked && (
                      <Lock
                        role="img"
                        className="size-3"
                        aria-label="Locked: kept as written in later rounds"
                      />
                    )}
                    {SOURCE_LABEL[rule.source]}
                  </span>
                </>
              )}
            </span>
            <button
              type="button"
              aria-label="Remove rule"
              disabled={saving}
              onClick={() => remove(rule.id)}
              className="inline-flex size-5.5 items-center justify-center rounded hover:bg-card disabled:opacity-50"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      <input
        aria-label={kind === "do" ? "Add a Do rule" : "Add a Don’t rule"}
        placeholder={kind === "do" ? "Add a Do rule" : "Add a Don’t rule"}
        value={drafts[kind]}
        maxLength={200}
        disabled={saving}
        onChange={(event) =>
          setDrafts((all) => ({ ...all, [kind]: event.target.value }))
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") add(kind);
        }}
        className={FIELD}
      />
    </div>
  );

  const doCount = rules.filter((rule) => rule.kind === "do").length;
  const campaignLine = campaignText(campaign);
  const settingsLine = settingsText(data.content.settings);
  const notAppliedLine = notAppliedText(data.content.notApplied);

  return (
    <section className="w-full overflow-hidden rounded-xl border border-border bg-card font-sans text-sm text-foreground shadow-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <FileText className="size-4" aria-hidden="true" />
        <span className="font-semibold">Creative brief</span>
        <span className="inline-flex h-5.5 items-center rounded-full bg-primary-subtle px-2 text-xs font-medium text-primary-text">
          v{data.version}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {doCount} Do · {rules.length - doCount} Don’t
          {campaignLine && ` · ${campaignLine}`}
        </span>
        <ChevronDown
          className={cn("size-4", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <ol
            aria-label="Brief versions"
            className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-xs text-muted-foreground"
          >
            {data.versions.map((item) => (
              <li
                key={item.version}
                aria-current={item.version === data.version}
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  item.version === data.version
                    ? "border-primary-text text-primary-text"
                    : "border-border",
                )}
              >
                v{item.version} · {CAUSE_LABEL[item.cause]}
                {item.cause === "round" && item.round ? ` ${item.round}` : ""}
              </li>
            ))}
          </ol>
          {error && (
            <p role="alert" className="m-0 text-[13px] text-destructive">
              {error}
            </p>
          )}
          <div className="grid grid-cols-3 gap-5">
            {column("do")}
            {column("dont")}
            <BriefContext
              workspaceId={workspaceId}
              content={data.content}
              facts={data.facts}
            />
          </div>
          {settingsLine && (
            <p className="m-0 text-xs text-muted-foreground">{settingsLine}</p>
          )}
          {notAppliedLine && (
            <p className="m-0 text-xs text-muted-foreground">
              {notAppliedLine}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
