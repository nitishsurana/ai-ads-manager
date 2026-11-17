import type { BrandChange } from "@/lib/admin";

export function BrandKitChanges({
  changes,
}: {
  changes: BrandChange[] | null;
}) {
  return (
    <section
      aria-label="Brand kit"
      className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-card p-3 text-[13px]"
    >
      <h3 className="m-0 text-xs font-medium text-muted-foreground">
        Brand kit, scraped vs edited
      </h3>
      {changes === null ? (
        <p className="m-0 text-muted-foreground">
          The stored brand kit could not be read.
        </p>
      ) : changes.length === 0 ? (
        <p className="m-0 text-muted-foreground">Unchanged from the scrape.</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="py-0.5 pr-3 font-medium">
                Field
              </th>
              <th scope="col" className="py-0.5 pr-3 font-medium">
                Scraped
              </th>
              <th scope="col" className="py-0.5 font-medium">
                Edited
              </th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.field} className="border-t border-border">
                <th scope="row" className="py-1 pr-3 font-medium">
                  {change.field}
                </th>
                <td className="py-1 pr-3 text-muted-foreground">
                  {change.scraped || "empty"}
                </td>
                <td className="py-1">{change.edited || "empty"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
