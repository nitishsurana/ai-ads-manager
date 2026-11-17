type ExamplePromptProps = {
  link: string;
  text: string;
  onSelect: () => void;
};

export function ExamplePrompt({ link, text, onSelect }: ExamplePromptProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5 text-left font-sans text-[13.5px] text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="font-mono text-[11.5px] break-all text-muted-foreground">
        {link}
      </span>
      <span>{text}</span>
    </button>
  );
}
