import type { Candidate } from "./types";

export type RoundFile = { bucket: "backgrounds" | "previews"; path: string };

export function candidateFiles(candidate: Candidate): RoundFile[] {
  return [
    ...(candidate.backgroundPath
      ? [{ bucket: "backgrounds" as const, path: candidate.backgroundPath }]
      : []),
    ...(candidate.previewPath
      ? [{ bucket: "previews" as const, path: candidate.previewPath }]
      : []),
  ];
}

// Only creatives that were shown keep their files.
export function discardedFiles(all: Candidate[], shown: Candidate[]) {
  const kept = new Set(shown.map((candidate) => candidate.index));
  return all
    .filter((candidate) => !kept.has(candidate.index))
    .flatMap(candidateFiles);
}
