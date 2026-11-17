import { TAGS, hasReason, type Tag } from "@/lib/round/feedback/tags";
import { messages } from "@/lib/messages";
import { cn } from "@/lib/utils";

type RejectReasonProps = {
  tags: Tag[];
  note: string;
  onToggleTag: (tag: Tag) => void;
  onNote: (note: string) => void;
  onBlur: () => void;
};

export function RejectReason({
  tags,
  note,
  onToggleTag,
  onNote,
  onBlur,
}: RejectReasonProps) {
  return (
    <fieldset className="m-0 flex w-full flex-col gap-2 border-0 p-0 font-sans text-sm text-foreground">
      <legend className="mb-2 p-0 text-[13px] font-medium">
        What should change?{" "}
        <span className="font-medium text-destructive">Required</span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {TAGS.map((tag) => {
          const on = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={on}
              onClick={() => onToggleTag(tag)}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-2.5 text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <textarea
        rows={2}
        aria-label="Reason for rejecting"
        placeholder="Say what to change, in a few words"
        value={note}
        maxLength={500}
        onChange={(event) => onNote(event.target.value)}
        onBlur={onBlur}
        className="block w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-primary-subtle"
      />
      {!hasReason(tags, note) && (
        <p className="m-0 text-xs text-warning-foreground">
          {messages.reject_reason_required}
        </p>
      )}
    </fieldset>
  );
}
