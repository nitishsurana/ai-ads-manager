type StatTileProps = {
  label: string;
  value: string;
  unit?: string;
  sub: string;
};

export function StatTile({ label, value, unit, sub }: StatTileProps) {
  return (
    <div className="flex w-full flex-col rounded-xl border border-border bg-card px-4 py-3.5 shadow-xs">
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className="m-0 text-2xl font-semibold tracking-tight tabular-nums">
        {value}{" "}
        <span className="text-sm font-medium text-muted-foreground">
          {unit}
        </span>
      </p>
      <p className="m-0 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
