import { readFileSync } from "node:fs";

export type CsvRow = Record<string, string>;

function parseCells(text: string) {
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      rows.at(-1)?.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      rows.at(-1)?.push(cell);
      cell = "";
      rows.push([]);
    } else {
      cell += char;
    }
  }
  if (cell || rows.at(-1)?.length) rows.at(-1)?.push(cell);
  return rows.filter((row) => row.length > 0);
}

export function readCsv(path: string): CsvRow[] {
  const [header = [], ...body] = parseCells(
    readFileSync(path, "utf8").replace(/^\uFEFF/, ""),
  );
  return body.map((cells) =>
    Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])),
  );
}
