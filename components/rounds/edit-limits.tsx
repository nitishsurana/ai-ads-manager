import { CircleAlert } from "lucide-react";
import { messages } from "@/lib/messages";
import {
  COPY_WORDS,
  CTA_WORDS,
  editProblem,
  HEADLINE_CHARS,
  HEADLINE_WORDS,
  wordCount,
} from "@/lib/round/copy/limits";
import { cn } from "@/lib/utils";

const OK =
  "inline-flex h-5.5 items-center rounded-full bg-muted-foreground/10 px-2 text-xs font-medium text-muted-foreground";
const BAD =
  "inline-flex h-5.5 items-center rounded-full border border-destructive-border bg-destructive-subtle px-2 text-xs font-medium text-destructive";

type EditLimitsProps = {
  headline: string;
  cta: string;
  eyebrow: string | null;
  // Layer 1's refusal of the last save, or a failed save.
  error: string | null;
  saving: boolean;
  // A rating is still being saved.
  blocked: boolean;
  onCancel: () => void;
  onSave: () => void;
};

export function EditLimits({
  headline,
  cta,
  eyebrow,
  error,
  saving,
  blocked,
  onCancel,
  onSave,
}: EditLimitsProps) {
  const headlineWords = wordCount(headline);
  const eyebrowWords = eyebrow ? wordCount(eyebrow) : 0;
  const ctaWords = wordCount(cta);
  const problem = editProblem({ headline, cta, eyebrow });
  const shown = problem ? messages[problem] : error;

  return (
    <div className="flex w-full flex-col gap-2 border-b border-border bg-muted p-3 font-sans text-sm text-foreground">
      <p className="m-0 text-xs text-muted-foreground">
        Type on the creative to edit the headline and CTA.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <span className={cn(headlineWords > HEADLINE_WORDS ? BAD : OK)}>
          Headline {headlineWords}/{HEADLINE_WORDS} words
        </span>
        <span className={cn(headline.length > HEADLINE_CHARS ? BAD : OK)}>
          {headline.length}/{HEADLINE_CHARS} characters
        </span>
        {eyebrow && (
          <span
            className={cn(headlineWords + eyebrowWords > COPY_WORDS ? BAD : OK)}
          >
            Headline + eyebrow {headlineWords + eyebrowWords}/{COPY_WORDS} words
          </span>
        )}
        <span className={cn(ctaWords > CTA_WORDS ? BAD : OK)}>
          CTA {ctaWords}/{CTA_WORDS} words
        </span>
      </div>
      {shown && (
        <p
          role="alert"
          className="m-0 flex items-start gap-1.5 text-[13px] text-destructive"
        >
          <CircleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{shown}</span>
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex h-8 items-center justify-center rounded-md px-3 text-[13px] font-medium hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={problem !== null || saving || blocked}
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? "Checking…" : "Save text"}
        </button>
      </div>
    </div>
  );
}
