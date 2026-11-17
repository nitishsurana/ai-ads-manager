import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminFilters } from "@/lib/admin";

type FilterBarProps = {
  filters: AdminFilters;
  testers: string[];
};

const SELECT =
  "block h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-primary-subtle";

type Option = [value: string, label: string];

function SelectField({
  id,
  label,
  value,
  options,
  className,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  className: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      <select id={id} name={id} defaultValue={value} className={SELECT}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterBar({ filters, testers }: FilterBarProps) {
  return (
    <form
      method="get"
      aria-label="Filters"
      className="flex flex-wrap items-end gap-2.5"
    >
      <SelectField
        id="tester"
        label="Tester"
        value={filters.tester}
        className="w-45"
        options={[
          ["", "All testers"],
          ...testers.map((name): Option => [name, name]),
        ]}
      />
      <SelectField
        id="date"
        label="Date"
        value={filters.date}
        className="w-40"
        options={[
          ["7", "Last 7 days"],
          ["30", "Last 30 days"],
          ["all", "All time"],
        ]}
      />
      <SelectField
        id="rating"
        label="Human rating"
        value={filters.rating}
        className="w-40"
        options={[
          ["any", "Any rating"],
          ["approved", "Has approvals"],
          ["rejected", "Has rejections"],
        ]}
      />
      <SelectField
        id="judge"
        label="Judge score"
        value={filters.judge}
        className="w-40"
        options={[
          ["any", "Any score"],
          ["low", "2 or lower"],
          ["high", "4 or higher"],
        ]}
      />
      <SelectField
        id="confidence"
        label="Confidence"
        value={filters.confidence}
        className="w-40"
        options={[
          ["any", "Any confidence"],
          ["low", "Low confidence"],
        ]}
      />
      <div className="min-w-55 flex-1">
        <label htmlFor="q" className="mb-1.5 block text-[13px] font-medium">
          Search
        </label>
        <Input
          id="q"
          name="q"
          defaultValue={filters.q}
          placeholder="Tester, product or URL"
        />
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
      <Link
        href="/admin"
        className="inline-flex h-9 items-center px-1 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        Reset
      </Link>
    </form>
  );
}
