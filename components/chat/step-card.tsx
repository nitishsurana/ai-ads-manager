const arts = {
  photos: (
    <div className="grid grid-cols-3 gap-1.5">
      <span className="aspect-square rounded-md border-2 border-primary bg-muted" />
      <span className="aspect-square rounded-md border-2 border-primary bg-muted" />
      <span className="aspect-square rounded-md border-2 border-border bg-muted" />
    </div>
  ),
  creatives: (
    <div className="flex justify-center gap-1.5">
      <span className="aspect-[9/16] w-9 rounded border border-border bg-muted" />
      <span className="aspect-[9/16] w-9 rounded border border-border bg-muted" />
      <span className="aspect-[9/16] w-9 rounded border border-border bg-muted" />
    </div>
  ),
  ratings: (
    <div className="flex gap-1.5">
      <span className="inline-flex h-5.5 items-center rounded-full border border-success-border bg-success-subtle px-2 text-xs font-medium text-success">
        Approve
      </span>
      <span className="inline-flex h-5.5 items-center rounded-full border border-destructive-border bg-destructive-subtle px-2 text-xs font-medium text-destructive">
        Reject · Colour
      </span>
    </div>
  ),
};

type StepCardProps = {
  n: number;
  title: string;
  body: string;
  art: keyof typeof arts;
};

export function StepCard({ n, title, body, art }: StepCardProps) {
  return (
    <div className="flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-5 font-sans text-sm text-foreground shadow-xs">
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-subtle text-[13px] font-semibold text-primary-text">
        {n}
      </span>
      <h2 className="m-0 text-base font-semibold tracking-tight">{title}</h2>
      <p className="m-0 text-[13.5px] text-muted-foreground">{body}</p>
      <div aria-hidden="true" className="mt-auto">
        {arts[art]}
      </div>
    </div>
  );
}
