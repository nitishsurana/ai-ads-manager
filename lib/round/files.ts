import type { Candidate } from "./types";

export type RoundFile = { bucket: "backgrounds" | "previews"; path: string };

// A candidate's files are named by its index, so a redone candidate overwrites its own and the names are known even when its record has no path.
export function candidateFiles(roundId: string, index: number): RoundFile[] {
  const path = `${roundId}/c${index}.jpg`;
  return [
    { bucket: "backgrounds", path },
    { bucket: "previews", path },
  ];
}

// Only creatives that were shown keep their files.
export function discardedFiles(
  roundId: string,
  all: Candidate[],
  shown: Candidate[],
) {
  const kept = new Set(shown.map((candidate) => candidate.index));
  return all
    .filter((candidate) => !kept.has(candidate.index))
    .flatMap((candidate) => candidateFiles(roundId, candidate.index));
}
