export function ChatDivider({ label }: { label: string }) {
  return (
    <div className="flex w-full items-center gap-2.5 font-sans text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
