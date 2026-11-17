"use client";

import { ArrowUp } from "lucide-react";
import type { KeyboardEvent, Ref } from "react";

type ChatComposerProps = {
  value: string;
  placeholder: string;
  busy: boolean;
  inputRef: Ref<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function ChatComposer({
  value,
  placeholder,
  busy,
  inputRef,
  onChange,
  onSubmit,
}: ChatComposerProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return;
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      className="w-full border-t border-border bg-card p-3 font-sans text-foreground"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card py-2 pr-2 pl-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-primary-subtle">
        <textarea
          ref={inputRef}
          id="chat-composer"
          aria-label="Message"
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="w-full resize-none border-0 bg-transparent p-0 text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] text-muted-foreground">
            Enter to send · Shift + Enter for a new line
          </span>
          <button
            type="submit"
            aria-label="Send"
            disabled={busy || value.trim() === ""}
            className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </form>
  );
}
