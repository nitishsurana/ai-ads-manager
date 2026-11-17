import type { JudgeRecord } from "@/lib/round";

const CRITERIA: [keyof JudgeRecord["medians"], string][] = [
  ["message", "Message"],
  ["hierarchy", "Hierarchy"],
  ["product", "Product"],
  ["brand_fit", "Brand fit"],
  ["slop", "Slop"],
];

// The model id's vendor prefix is dropped to keep the column narrow.
const modelName = (model: string) => model.split("/").pop() ?? model;

export function JudgeScores({ judge }: { judge: JudgeRecord }) {
  return (
    <div className="flex flex-col gap-1.5">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="py-0.5 pr-2 text-left font-medium">
              Judge
            </th>
            {CRITERIA.map(([key, label]) => (
              <th key={key} scope="col" className="px-1 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono">
          <tr className="border-t border-border font-semibold">
            <th scope="row" className="py-0.5 pr-2 text-left font-sans">
              Panel median
            </th>
            {CRITERIA.map(([key]) => (
              <td key={key} className="px-1 text-center">
                {judge.medians[key]}
              </td>
            ))}
          </tr>
          {judge.judges.map((vote) => (
            <tr key={vote.model} className="border-t border-border">
              <th
                scope="row"
                className="max-w-28 truncate py-0.5 pr-2 text-left font-sans font-normal"
                title={vote.model}
              >
                {modelName(vote.model)}
              </th>
              {CRITERIA.map(([key]) => (
                <td key={key} className="px-1 text-center">
                  {vote.scores[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Reasons</summary>
        <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
          {judge.judges.map((vote) => (
            <li key={vote.model}>
              <span className="font-medium text-foreground">
                {modelName(vote.model)}
              </span>
              {CRITERIA.map(([key, label]) => (
                <span key={key} className="block">
                  {label}: {vote.reasons[key]}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
